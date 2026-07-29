/**
 * Skládání e-mailu pro Gmail API. Gmail chce hotovou zprávu podle RFC 2822,
 * takže se hlavičky i tělo musí zakódovat ručně — čeština v předmětu jinak
 * dorazí rozsypaná.
 */

/** Zalomení řádku v hlavičce by šlo zneužít na propašování dalších hlaviček. */
function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

// 30 bajtů dá 40 znaků base64, s obálkou =?UTF-8?B?…?= se vejdeme do limitu
// 75 znaků na jedno zakódované slovo podle RFC 2047.
const MAX_BYTES_PER_WORD = 30;

/** Zakóduje hlavičku, pokud obsahuje něco jiného než tisknutelné ASCII. */
export function encodeHeader(value: string): string {
  const clean = singleLine(value);
  if (/^[\x20-\x7e]*$/.test(clean)) return clean;

  const chunks: string[] = [];
  let current = "";

  // Dělíme po znacích, ne po bajtech, aby se neroztrhl vícebajtový znak.
  for (const char of clean) {
    if (Buffer.byteLength(current + char, "utf8") > MAX_BYTES_PER_WORD) {
      chunks.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  if (current !== "") chunks.push(current);

  return chunks
    .map((chunk) => `=?UTF-8?B?${Buffer.from(chunk, "utf8").toString("base64")}?=`)
    .join("\r\n ");
}

/** Adresa s volitelným zobrazovaným jménem. Jméno se kóduje, adresa nikdy. */
export function formatAddress(email: string, name?: string | null): string {
  const address = singleLine(email);
  const label = name ? singleLine(name) : "";
  return label === "" ? address : `${encodeHeader(label)} <${address}>`;
}

export function buildRawMessage({
  to,
  from,
  fromName,
  subject,
  body,
}: {
  to: string;
  from: string;
  fromName?: string | null;
  subject: string;
  body: string;
}): string {
  const headers = [
    `From: ${formatAddress(from, fromName)}`,
    `To: ${singleLine(to)}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
  ];

  // Base64 v těle smí mít nejvýš 76 znaků na řádek.
  const encoded = Buffer.from(body.replace(/\r?\n/g, "\r\n"), "utf8")
    .toString("base64")
    .replace(/(.{76})/g, "$1\r\n");

  return `${headers.join("\r\n")}\r\n\r\n${encoded}`;
}

/** Gmail API přijímá zprávu jako base64url. */
export function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}
