"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { disconnectGoogleAccount } from "@/lib/google";

/** Zruší napojení na Gmail a odvolá token i u Googlu. */
export async function disconnectGmail() {
  const user = await requireUser();
  await disconnectGoogleAccount(user.id);
  revalidatePath("/settings");
}
