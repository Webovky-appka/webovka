"use server";

import argon2 from "argon2";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import * as z from "zod";

import { prisma } from "@/lib/prisma";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  cookieOptions,
  createSessionToken,
} from "@/lib/session";

const LoginSchema = z.object({
  email: z.string().trim().min(1, "Zadejte e-mail."),
  password: z.string().min(1, "Zadejte heslo."),
});

export type LoginState = { error?: string } | undefined;

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neplatný vstup." };
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });

  // Stejná hláška pro neznámý e-mail i špatné heslo, aby nešlo zjišťovat existenci účtů.
  const invalid = { error: "Neplatný e-mail nebo heslo." };
  if (!user) return invalid;

  const passwordMatches = await argon2.verify(
    user.passwordHash,
    parsed.data.password,
  );
  if (!passwordMatches) return invalid;

  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(user.id), {
    ...cookieOptions,
    maxAge: SESSION_TTL_SECONDS,
  });

  const nextPath = formData.get("next");
  const safeNext =
    typeof nextPath === "string" && nextPath.startsWith("/")
      ? nextPath
      : "/projects";

  redirect(safeNext);
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
