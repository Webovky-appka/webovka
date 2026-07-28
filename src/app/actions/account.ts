"use server";

import argon2 from "argon2";
import { revalidatePath } from "next/cache";
import * as z from "zod";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type PasswordState = { error?: string; success?: string } | undefined;

const PasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Zadejte současné heslo."),
    newPassword: z
      .string()
      .min(10, "Nové heslo musí mít alespoň 10 znaků.")
      .max(200, "Heslo je příliš dlouhé."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    error: "Nové heslo a jeho potvrzení se neshodují.",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    error: "Nové heslo se musí lišit od současného.",
    path: ["newPassword"],
  });

export async function changePassword(
  _prevState: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const sessionUser = await requireUser();

  const parsed = PasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neplatný vstup." };
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { passwordHash: true },
  });
  if (!user) return { error: "Účet nebyl nalezen." };

  const currentMatches = await argon2.verify(
    user.passwordHash,
    parsed.data.currentPassword,
  );
  if (!currentMatches) {
    return { error: "Současné heslo není správné." };
  }

  await prisma.user.update({
    where: { id: sessionUser.id },
    data: { passwordHash: await argon2.hash(parsed.data.newPassword) },
  });

  revalidatePath("/settings");
  return { success: "Heslo bylo změněno." };
}
