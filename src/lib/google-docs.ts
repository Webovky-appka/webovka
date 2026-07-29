import "server-only";

import { accessTokenFor } from "@/lib/google";

/**
 * Zakládání dokumentů v Google Docs. Soubor vzniká na Drive přihlášeného
 * uživatele, takže mu zůstane i po odpojení aplikace. Text vkládáme zvlášť
 * přes Docs API — Drive umí soubor jen vytvořit, ne naplnit.
 *
 * Kdo dokument založil, ten na něj má právo. Kolegům se musí nasdílet v Docs,
 * aplikace do sdílení nesahá.
 */
const DRIVE_CREATE_URL =
  "https://www.googleapis.com/drive/v3/files?fields=id%2CwebViewLink";
const DOCS_MIME = "application/vnd.google-apps.document";

export type CreateDocResult =
  | { docId: string; webViewLink: string }
  | { error: string };

type DriveFile = {
  id?: string;
  webViewLink?: string;
  error?: { message?: string; status?: string };
};

/** Hlášky Googlu jsou anglicky a mluví o project number — přeložíme je do věty, která pomůže. */
function explainFailure(status: number, message: string | undefined): string {
  if (status === 401) {
    return "Napojení na Google vypršelo. Napojte účet znovu v Nastavení.";
  }
  if (message?.includes("has not been used in project") || status === 404) {
    return "V Google Cloudu není zapnuté Google Drive API nebo Google Docs API. Zapněte obojí a zkuste to znovu.";
  }
  if (status === 403) {
    return "Google zakládání dokumentu odmítl. Napojte účet znovu — starší napojení nemá oprávnění k dokumentům.";
  }
  return "Dokument se nepodařilo založit. Podrobnost je v logu serveru.";
}

async function readError(response: Response): Promise<string | undefined> {
  const data = (await response.json().catch(() => null)) as DriveFile | null;
  return data?.error?.message;
}

/**
 * Vytvoří dokument a vloží do něj text. Když se vložení textu nepovede,
 * dokument stejně vrátíme — prázdný dokument je lepší než ztracený odkaz.
 */
export async function createGoogleDoc({
  userId,
  title,
  body,
}: {
  userId: string;
  title: string;
  body: string;
}): Promise<CreateDocResult> {
  const token = await accessTokenFor(userId);
  if ("error" in token) return { error: token.error };

  let file: DriveFile;
  try {
    const response = await fetch(DRIVE_CREATE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: title, mimeType: DOCS_MIME }),
      cache: "no-store",
    });

    if (!response.ok) {
      const message = await readError(response);
      console.error(
        `[docs] Vytvoření dokumentu selhalo (${response.status}): ${message ?? "bez popisu"}`,
      );
      return { error: explainFailure(response.status, message) };
    }

    file = (await response.json()) as DriveFile;
  } catch (error) {
    console.error("[docs] Spojení s Google Drive selhalo:", error);
    return { error: "Nepodařilo se spojit s Google Drive." };
  }

  if (!file.id) {
    return { error: "Google nevrátil identifikátor dokumentu." };
  }

  if (body.trim() !== "") {
    await insertText(token.token, file.id, body);
  }

  return {
    docId: file.id,
    webViewLink:
      file.webViewLink ?? `https://docs.google.com/document/d/${file.id}/edit`,
  };
}

/** Vloží text na začátek dokumentu. Index 1 je první pozice, na kterou se smí psát. */
async function insertText(
  token: string,
  docId: string,
  text: string,
): Promise<void> {
  try {
    const response = await fetch(
      `https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: [{ insertText: { location: { index: 1 }, text } }],
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      console.error(
        `[docs] Vložení textu selhalo (${response.status}): ${(await readError(response)) ?? "bez popisu"}`,
      );
    }
  } catch (error) {
    console.error("[docs] Spojení s Google Docs selhalo:", error);
  }
}
