/**
 * Vzorové e-maily do podkladů pro Outreach. Čistý modul, aby šlo testovat
 * to nejdůležitější: vzory jdou k modelu jako ukázka tónu a stavby, nikdy
 * jako zdroj faktů. Vzor je o cizí firmě — kdyby z něj model opsal detail,
 * vznikne tvrzení, které o adresátovi neplatí.
 */

export type EmailSample = {
  label: string;
  subject: string | null;
  body: string;
  note: string | null;
};

/** Kolik vzorů se posílá a kolik znaků z nich. Podklady nesmí přerůst zadání. */
export const MAX_SAMPLES = 3;
export const MAX_SAMPLE_CHARS = 1500;

function trim(text: string): string {
  return text.length <= MAX_SAMPLE_CHARS
    ? text
    : `${text.slice(0, MAX_SAMPLE_CHARS)}\n…(zkráceno)`;
}

/**
 * Blok s ukázkami stylu. Prázdné pole vrací prázdný blok — bez vzorů se
 * v podkladech o žádných nemluví.
 */
export function buildSampleBlock(samples: EmailSample[]): string[] {
  const used = samples.slice(0, MAX_SAMPLES);
  if (used.length === 0) return [];

  return [
    `Vzorové e-maily od majitele studia (${used.length}) — takhle chce, aby ses vyjadřoval:`,
    ...used.flatMap((sample, index) => [
      `--- vzor ${index + 1}: ${sample.label} ---`,
      ...(sample.note ? [`Co si na něm cenit: ${sample.note}`] : []),
      ...(sample.subject ? [`Předmět: ${sample.subject}`] : []),
      trim(sample.body),
    ]),
    "--- konec vzorů ---",
    "Ze vzorů si vezmi TÓN, stavbu, délku, míru zdvořilosti a způsob oslovení.",
    "NIKDY z nich neber fakta, jména, čísla ani odkazy — jsou o jiných firmách",
    "a o adresátovi neplatí. Vzor neopisuj věta po větě, piš vlastní text.",
    "",
  ];
}
