import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, verifyToken } from "@/lib/session";

export type SessionUser = Pick<
  User,
  "id" | "email" | "name" | "role" | "googleAccountIndex"
>;

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const userId = verifyToken(store.get(SESSION_COOKIE)?.value);
  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      googleAccountIndex: true,
    },
  });
}

/**
 * Ověří přihlášení. Volat v každé Server Action a na každé chráněné stránce —
 * Server Actions jsou dosažitelné přímým POST requestem, ne jen z našeho UI.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
