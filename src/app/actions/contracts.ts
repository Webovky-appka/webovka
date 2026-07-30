"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";

import { generateText, isAiConfigured } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import {
  buildContract,
  CONTRACT_DEFAULTS,
  equalShares,
  supplierFromEnv,
  type ContractParams,
} from "@/lib/contract-template";
import { logSystemEvent } from "@/lib/events";
import { prisma } from "@/lib/prisma";

export type ContractState =
  | {
      error?: string;
      success?: string;
      body?: string;
      /** Přesné zadání pro model, aby bylo vidět, co se posílá. */
      promptSystem?: string;
      promptUser?: string;
      sentToAi?: boolean;
    }
  | undefined;

const ParamsSchema = z.object({
  projectId: z.string().min(1, "Vyberte zakázku."),
  totalPrice: z
    .number()
    .int("Cena musí být celé číslo.")
    .min(1, "Zadejte cenu díla.")
    .max(100_000_000, "Cena je nepravděpodobně vysoká."),
  depositPercent: z
    .number()
    .int()
    .min(0, "Záloha nemůže být záporná.")
    .max(100, "Záloha nemůže být víc než sto procent."),
  hourlyRate: z
    .number()
    .int()
    .min(0)
    .max(100_000, "Hodinová sazba je nepravděpodobně vysoká."),
  revisionsPerPhase: z.number().int().min(0).max(20),
  paymentDays: z.number().int().min(1).max(180),
});

function num(formData: FormData, key: string, fallback: number): number {
  const raw = formData.get(key);
  if (typeof raw !== "string" || raw.trim() === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.round(value) : fallback;
}

async function loadParams(
  input: z.infer<typeof ParamsSchema>,
  userName: string,
): Promise<{ params: ContractParams; clientId: string } | null> {
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: {
      name: true,
      clientId: true,
      client: {
        select: {
          companyName: true,
          contactPerson: true,
          email: true,
          phone: true,
        },
      },
      phases: {
        orderBy: { position: "asc" },
        select: { name: true, dueDate: true },
      },
    },
  });

  if (!project) return null;

  const shares = equalShares(project.phases.length);

  return {
    clientId: project.clientId,
    params: {
      supplier: supplierFromEnv(userName),
      client: {
        companyName: project.client.companyName,
        contactPerson: project.client.contactPerson,
        email: project.client.email,
        phone: project.client.phone,
        // IČO ani sídlo klienta v aplikaci nevedeme, doplní se do smlouvy ručně.
        ico: null,
        address: null,
      },
      projectName: project.name,
      totalPrice: input.totalPrice,
      depositPercent: input.depositPercent,
      hourlyRate: input.hourlyRate,
      revisionsPerPhase: input.revisionsPerPhase,
      paymentDays: input.paymentDays,
      phases: project.phases.map((phase, index) => ({
        name: phase.name,
        dueDate: phase.dueDate,
        share: shares[index] ?? 0,
      })),
    },
  };
}

function systemPrompt(): string {
  return [
    "Upravuješ českou smlouvu o dílo pro webové studio. Dostaneš hotovou smlouvu",
    "a pokyn, co v ní změnit. Vrať CELÝ text smlouvy se zapracovanou změnou,",
    "nic jiného — žádný komentář, žádné vysvětlení.",
    "",
    "Zachovej strukturu, číslování článků a právní jazyk.",
    "",
    "Tyto ochrany nesmíš oslabit ani vypustit, pokud si to pokyn výslovně nežádá:",
    "- licence přechází na objednatele až úplným zaplacením celé ceny,",
    "- omezení náhrady škody do výše skutečně zaplacené ceny,",
    "- počet kol úprav v ceně a sazba za práce nad rámec,",
    "- prodlení objednatele staví termíny,",
    "- objednatel ručí za práva k dodaným podkladům.",
    "",
    "Když pokyn některou z těchto ochran ruší, uprav ji podle pokynu, ale na",
    "první řádek odpovědi napiš: POZOR: <čeho se změna týká>.",
    "",
    "Nevymýšlej si čísla, jména ani termíny, které ve smlouvě nejsou.",
  ].join("\n");
}

/**
 * Složí smlouvu ze šablony a případně na ni pustí model. Bez klíče k modelu se
 * vrátí čistá šablona — text smlouvy vzniká vždy u nás, model ho jen upravuje.
 */
export async function composeContract(
  prevState: ContractState,
  formData: FormData,
): Promise<ContractState> {
  const user = await requireUser();

  const parsed = ParamsSchema.safeParse({
    projectId: String(formData.get("projectId") ?? ""),
    totalPrice: num(formData, "totalPrice", 0),
    depositPercent: num(formData, "depositPercent", CONTRACT_DEFAULTS.depositPercent),
    hourlyRate: num(formData, "hourlyRate", CONTRACT_DEFAULTS.hourlyRate),
    revisionsPerPhase: num(
      formData,
      "revisionsPerPhase",
      CONTRACT_DEFAULTS.revisionsPerPhase,
    ),
    paymentDays: num(formData, "paymentDays", CONTRACT_DEFAULTS.paymentDays),
  });

  if (!parsed.success) {
    return {
      body: prevState?.body,
      error: parsed.error.issues[0]?.message ?? "Neplatný vstup.",
    };
  }

  const loaded = await loadParams(parsed.data, user.name);
  if (!loaded) return { body: prevState?.body, error: "Zakázka nenalezena." };

  const template = buildContract(loaded.params);
  const instruction = String(formData.get("instruction") ?? "").trim();
  const mode = formData.get("mode");

  // Složení ze šablony. Vždycky přepíše text, o to při téhle volbě jde.
  if (mode === "template") {
    return { body: template, sentToAi: false };
  }

  if (instruction === "") {
    return {
      body: prevState?.body ?? template,
      sentToAi: false,
      error: "Napište, co má model ve smlouvě změnit.",
    };
  }

  // Model dostane text, který má upravit — ne prázdný list.
  const base = prevState?.body?.trim() ? prevState.body : template;
  const prompt = {
    promptSystem: systemPrompt(),
    promptUser: [
      "Smlouva:",
      base,
      "",
      `Pokyn: ${instruction}`,
    ].join("\n"),
  };

  if (!isAiConfigured()) {
    return {
      body: base,
      ...prompt,
      sentToAi: false,
      error: "Bez OPENAI_API_KEY model smlouvu neupraví. Text je ze šablony.",
    };
  }

  const result = await generateText({
    system: prompt.promptSystem,
    prompt: prompt.promptUser,
    maxTokens: 4000,
  });

  if ("error" in result) {
    return {
      body: base,
      ...prompt,
      sentToAi: true,
      error: `${result.error} Text zůstal beze změny.`,
    };
  }

  return { body: result.text, ...prompt, sentToAi: true };
}

/** Uloží text smlouvy k zakázce. Odsud se pak stahuje Word. */
export async function saveContract(
  _prevState: ContractState,
  formData: FormData,
): Promise<ContractState> {
  const user = await requireUser();

  const projectId = String(formData.get("projectId") ?? "");
  const body = String(formData.get("body") ?? "").replace(/\r\n/g, "\n");

  if (projectId === "") return { error: "Vyberte zakázku." };
  if (body.trim() === "") return { error: "Smlouva nemá žádný text." };

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { clientId: true, name: true },
  });
  if (!project) return { error: "Zakázka nenalezena." };

  const values = {
    body,
    totalPrice: num(formData, "totalPrice", 0),
    depositPercent: num(formData, "depositPercent", CONTRACT_DEFAULTS.depositPercent),
    hourlyRate: num(formData, "hourlyRate", CONTRACT_DEFAULTS.hourlyRate),
    revisionsPerPhase: num(
      formData,
      "revisionsPerPhase",
      CONTRACT_DEFAULTS.revisionsPerPhase,
    ),
    paymentDays: num(formData, "paymentDays", CONTRACT_DEFAULTS.paymentDays),
  };

  const existing = await prisma.contract.findUnique({
    where: { projectId },
    select: { id: true },
  });

  await prisma.contract.upsert({
    where: { projectId },
    create: { projectId, createdById: user.id, ...values },
    update: values,
  });

  // Do komunikace se zapisuje jen vznik smlouvy, ne každá úprava textu.
  if (!existing) {
    await logSystemEvent({
      clientId: project.clientId,
      projectId,
      body: `${user.name} připravil smlouvu k zakázce ${project.name}.`,
    });
  }

  revalidatePath("/contracts");
  revalidatePath(`/clients/${project.clientId}`);

  return { body, success: "Smlouva uložena. Word si stáhnete tlačítkem níž." };
}
