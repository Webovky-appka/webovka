import "server-only";

import type { SalesCampaign } from "@prisma/client";
import * as z from "zod";

import { prisma } from "@/lib/prisma";
import { isSharedPlatformDomain, normalizeDomain } from "@/lib/sales/dedupe";
import { normalizeFoundEmail } from "@/lib/sales/email-hygiene";
import { callAgentModel } from "@/lib/sales/model";
import { getActivePrompt } from "@/lib/sales/prompts";

/**
 * Contact Research (sekce 10 specifikace): dohledá ověřitelné kontakty
 * a pokud možno rozhodující osobu. E-mail se nikdy neodhaduje — model smí
 * uložit jen adresu, kterou skutečně našel, a s ní zdroj.
 *
 * Výsledek fáze je vždy posun stavu na RESEARCHING, i když se nic nenašlo —
 * prázdný výsledek je informace, ne důvod zkoušet to donekonečna.
 */

const ContactSchema = z.object({
  contacts: z.array(
    z.object({
      name: z.string(),
      role: z.string(),
      email: z.string(),
      phone: z.string(),
      source: z.string().min(1),
      confidence: z.number().min(0).max(1),
      isDecisionMaker: z.boolean(),
    }),
  ),
  /** Vlastní web firmy, pokud na něj research narazil. Prázdné = nenašel. */
  website: z.string(),
  summary: z.string(),
});

const CONTACT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["contacts", "website", "summary"],
  properties: {
    contacts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "name",
          "role",
          "email",
          "phone",
          "source",
          "confidence",
          "isDecisionMaker",
        ],
        properties: {
          name: {
            type: "string",
            description: "Jméno osoby, prázdný řetězec u obecného kontaktu",
          },
          role: {
            type: "string",
            description: "Role (majitel, jednatel…), prázdné když neznámá",
          },
          email: {
            type: "string",
            description:
              "JEN skutečně nalezená adresa, jinak prázdný řetězec. Nikdy neodhadovat.",
          },
          phone: { type: "string", description: "Telefon, jinak prázdné" },
          source: {
            type: "string",
            description: "Kde přesně byl kontakt nalezen (stránka, rejstřík…)",
          },
          confidence: { type: "number" },
          isDecisionMaker: { type: "boolean" },
        },
      },
    },
    website: {
      type: "string",
      description:
        "Adresa VLASTNÍHO webu firmy, pokud jsi na něj při hledání narazil (ne Facebook ani katalogy). Prázdný řetězec, když web nemá nebo sis nejistý.",
    },
    summary: { type: "string" },
  },
} as const;

const emptyToNull = (value: string): string | null =>
  value.trim() === "" ? null : value.trim();

export type ContactOutcome =
  | { ok: true; found: number; withEmail: number }
  | { ok: false; error: string };

export async function researchContact(options: {
  leadId: string;
  campaign: SalesCampaign;
  runId: string;
}): Promise<ContactOutcome> {
  const { leadId, campaign, runId } = options;

  const lead = await prisma.salesLead.findUnique({
    where: { id: leadId },
    include: { prospect: { include: { contacts: true } } },
  });
  if (!lead) return { ok: false, error: "Lead nenalezen." };

  // Kontakty už jednou dohledané se nedohledávají znovu — jen se posune stav.
  if (lead.prospect.contacts.length > 0) {
    await prisma.salesLead.update({
      where: { id: leadId },
      data: { status: "RESEARCHING" },
    });
    return {
      ok: true,
      found: lead.prospect.contacts.length,
      withEmail: lead.prospect.contacts.filter((c) => c.email).length,
    };
  }

  const prompt = await getActivePrompt("contact");

  const input = [
    `Dohledej kontakty pro firmu: ${lead.prospect.name}`,
    `Web: ${lead.prospect.domain ?? "neznámý"}`,
    `Obor a místo: ${lead.prospect.industry ?? "?"}, ${lead.prospect.location ?? "?"}`,
    "",
    "Hledej na webu firmy (kontaktní stránka, patička), v obchodním rejstříku",
    "a na profilech firmy. Chceme rozhodující osobu — majitele nebo jednatele.",
    "Když najdeš jen obecný kontakt (info@…), ulož ho a rozhodující osobu uveď",
    "zvlášť, klidně bez e-mailu. U každého kontaktu uveď přesný zdroj.",
    "E-mailovou adresu NIKDY nesestavuj podle vzoru — jen co jsi skutečně našel.",
    "Pokud při hledání narazíš na VLASTNÍ web firmy, vrať jeho adresu v poli",
    "website — i když ho máme vedené jako firmu bez webu.",
  ].join("\n");

  const result = await callAgentModel({
    task: "contact",
    agent: "contact",
    system: prompt.system,
    input,
    schemaName: "contact_research",
    jsonSchema: CONTACT_JSON_SCHEMA,
    zodSchema: ContactSchema,
    useWebSearch: true,
    promptVersionId: prompt.versionId,
    runId,
    campaignId: campaign.id,
    leadId,
  });

  if (!result.ok) return { ok: false, error: result.error };

  const cleaned = result.data.contacts
    .map((contact) => ({
      name: emptyToNull(contact.name),
      role: emptyToNull(contact.role),
      email: normalizeFoundEmail(contact.email),
      phone: emptyToNull(contact.phone),
      source: contact.source.trim(),
      confidence: contact.confidence,
      isDecisionMaker: contact.isDecisionMaker,
    }))
    // Bez zdroje se kontakt nesmí uložit; úplně prázdný záznam nemá smysl.
    .filter(
      (contact) =>
        contact.source !== "" &&
        (contact.name || contact.email || contact.phone),
    );

  // Primární kontakt: nejjistější s e-mailem.
  const primaryIndex = cleaned
    .map((contact, index) => ({ contact, index }))
    .filter(({ contact }) => contact.email !== null)
    .sort((a, b) => b.contact.confidence - a.contact.confidence)[0]?.index;

  for (const [index, contact] of cleaned.entries()) {
    await prisma.salesContact.create({
      data: {
        prospectId: lead.prospectId,
        name: contact.name,
        role: contact.role,
        email: contact.email,
        phone: contact.phone,
        source: contact.source,
        confidence: contact.confidence,
        isPrimary: index === primaryIndex,
      },
    });
  }

  // Firma vedená bez vlastního webu, u které research na web narazil:
  // doména se doplní a příležitost se vrací do auditu — „nemá web“ byla
  // jen díra ve vyhledávání, ne fakt.
  const hadOwnWebsite =
    lead.prospect.domain !== null &&
    !isSharedPlatformDomain(lead.prospect.domain);
  const foundDomain = normalizeDomain(result.data.website);
  let websiteDiscovered = false;

  if (!hadOwnWebsite && foundDomain && !isSharedPlatformDomain(foundDomain)) {
    const taken = await prisma.prospect.findUnique({
      where: { domain: foundDomain },
      select: { id: true },
    });
    if (!taken || taken.id === lead.prospectId) {
      await prisma.prospect.update({
        where: { id: lead.prospectId },
        data: { domain: foundDomain },
      });
      websiteDiscovered = true;
    }
  }

  await prisma.salesLead.update({
    where: { id: leadId },
    // Nalezený web znamená návrat do auditu — teď je co fotit a hodnotit.
    data: { status: websiteDiscovered ? "QUALIFIED" : "RESEARCHING" },
  });

  const withEmail = cleaned.filter((contact) => contact.email !== null).length;

  await prisma.salesActivity.create({
    data: {
      prospectId: lead.prospectId,
      leadId,
      actor: "contact",
      kind: "contact_research",
      body: [
        cleaned.length === 0
          ? "Kontakt se nepodařilo dohledat. Doplníte ho ručně při schvalování."
          : `Dohledáno ${cleaned.length} kontaktů, z toho ${withEmail} s e-mailem. ${result.data.summary}`,
        websiteDiscovered
          ? ` Našel se vlastní web ${foundDomain} — příležitost se vrací do auditu.`
          : "",
      ].join(""),
      meta: { runId, websiteDiscovered },
    },
  });

  return { ok: true, found: cleaned.length, withEmail };
}
