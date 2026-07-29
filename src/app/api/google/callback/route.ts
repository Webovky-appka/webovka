import { NextResponse, type NextRequest } from "next/server";

import { requireUser } from "@/lib/auth";
import { connectGoogleAccount } from "@/lib/google";
import { verifyToken } from "@/lib/session";

/**
 * Návrat z Googlu. Výsledek se předává jako krátký kód v adrese, ne jako text —
 * cizí odkaz by jinak mohl uživateli podstrčit vymyšlenou zprávu.
 */
export async function GET(request: NextRequest) {
  const user = await requireUser();
  const params = new URL(request.url).searchParams;

  const back = (result: string) =>
    NextResponse.redirect(new URL(`/settings?gmail=${result}`, request.url));

  if (params.get("error")) return back("zamitnuto");

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) return back("chyba");

  // Stav musí patřit právě přihlášenému uživateli.
  if (verifyToken(state) !== user.id) return back("stav");

  const result = await connectGoogleAccount(user.id, code);
  if ("error" in result) {
    console.error(`[google] Napojení selhalo: ${result.error}`);
    return back(result.error.includes("trvalý") ? "bez-tokenu" : "chyba");
  }

  return back("ok");
}
