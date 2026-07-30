"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type StudioState = { error?: string; success?: string } | undefined;

const optionalText = z
  .string()
  .trim()
  .max(200, "Údaj je příliš dlouhý.")
  .transform((value) => (value === "" ? null : value))
  .nullable();

const StudioSchema = z.object({
  name: optionalText,
  ico: optionalText,
  dic: optionalText,
  address: optionalText,
  bankAccount: optionalText,
  representedBy: optionalText,
});

/** Údaje studia do smluv. Jeden řádek, takže se jen přepisuje. */
export async function updateStudioProfile(
  _prevState: StudioState,
  formData: FormData,
): Promise<StudioState> {
  await requireUser();

  const parsed = StudioSchema.safeParse({
    name: formData.get("name"),
    ico: formData.get("ico"),
    dic: formData.get("dic"),
    address: formData.get("address"),
    bankAccount: formData.get("bankAccount"),
    representedBy: formData.get("representedBy"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neplatný vstup." };
  }

  await prisma.studioProfile.upsert({
    where: { id: "studio" },
    create: { id: "studio", ...parsed.data },
    update: parsed.data,
  });

  revalidatePath("/settings");
  revalidatePath("/contracts");

  return { success: "Údaje uloženy. Použijí se v nových smlouvách." };
}
