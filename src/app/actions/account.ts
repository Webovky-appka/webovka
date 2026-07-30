"use server";

import argon2 from "argon2";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PasswordChangeSchema } from "@/lib/validation";

export type PasswordState = { error?: string; success?: string } | undefined;

export async function changePassword(
  _prevState: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const sessionUser = await requireUser();

  const parsed = PasswordChangeSchema.safeParse({
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

/** Nejvyšší rozumné pořadí účtu. Víc než dvacet účtů v prohlížeči nikdo nemá. */
const MAX_ACCOUNT_INDEX = 20;

/**
 * Pořadí účtu Google pro rychlé odkazy v navigaci. Prázdná hodnota ho zruší
 * a odkazy se vrátí k výchozímu nastavení celého nasazení.
 */
export async function setGoogleAccountIndex(formData: FormData) {
  const user = await requireUser();

  const raw = formData.get("googleAccountIndex");
  if (typeof raw !== "string") return;

  let index: number | null = null;
  if (raw.trim() !== "") {
    const parsed = Number(raw);
    if (!Number.isInteger(parsed)) return;
    if (parsed < 0 || parsed > MAX_ACCOUNT_INDEX) return;
    index = parsed;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { googleAccountIndex: index },
  });

  // Odkazy jsou v layoutu, takže se musí překreslit celá interní část.
  revalidatePath("/", "layout");
}
