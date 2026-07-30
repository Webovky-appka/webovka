import "server-only";

import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

/**
 * Převod smlouvy z textu do Wordu. Text může přijít i od modelu, takže se
 * struktura nepředpokládá — co se nepozná jako nadpis, projde jako odstavec.
 */

/** Nadpis článku, například „IV. CENA A PLATEBNÍ PODMÍNKY“. */
const ARTICLE = /^[IVXLC]+\.\s+\p{Lu}[\p{Lu}\s]*$/u;

/** Zvýraznění **takhle** převedeme na tučný text, ostatní hvězdičky zůstanou. */
function runs(line: string): TextRun[] {
  return line
    .split(/(\*\*[^*]+\*\*)/)
    .filter((part) => part !== "")
    .map((part) => {
      const bold = part.startsWith("**") && part.endsWith("**");
      return new TextRun({
        text: bold ? part.slice(2, -2) : part,
        bold,
      });
    });
}

function paragraph(line: string, index: number): Paragraph {
  const text = line.trimEnd();

  if (text === "") return new Paragraph({ text: "" });

  // První neprázdný řádek je název smlouvy.
  if (index === 0) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: runs(text),
    });
  }

  if (ARTICLE.test(text)) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 120 },
      children: runs(text),
    });
  }

  return new Paragraph({
    spacing: { after: 120 },
    // Odsazené řádky rozpisu ceny si odsazení udrží.
    indent: line.startsWith("   ") ? { left: 400 } : undefined,
    children: runs(text),
  });
}

export async function contractToDocx({
  text,
  title,
}: {
  text: string;
  title: string;
}): Promise<Buffer> {
  const lines = text.replace(/\r\n/g, "\n").split("\n");

  const document = new Document({
    title,
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22 },
        },
      },
    },
    sections: [
      {
        properties: {},
        children: lines.map((line, index) => paragraph(line, index)),
      },
    ],
  });

  return Packer.toBuffer(document);
}

/** Název souboru bez diakritiky a mezer, ať projde všemi systémy. */
export function contractFileName(projectName: string): string {
  const slug = projectName
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return `smlouva-${slug || "zakazka"}.docx`;
}
