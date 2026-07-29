import { NextResponse, type NextRequest } from "next/server";

import { requireUser } from "@/lib/auth";
import { buildAuthUrl, isGoogleConfigured } from "@/lib/google";
import { createToken } from "@/lib/session";

/** Platnost odkazu na Google. Delší už není potřeba, přihlášení je otázka minut. */
const STATE_TTL_SECONDS = 600;

/**
 * Zahájí napojení na Gmail. Stav (state) je podepsaný token s id uživatele —
 * při návratu se ověří podpis i to, že se vrací tomu, kdo napojení začal.
 */
export async function GET(request: NextRequest) {
  const user = await requireUser();

  if (!isGoogleConfigured()) {
    return NextResponse.redirect(
      new URL("/settings?gmail=nenastaveno", request.url),
    );
  }

  return NextResponse.redirect(
    buildAuthUrl(createToken(user.id, STATE_TTL_SECONDS)),
  );
}
