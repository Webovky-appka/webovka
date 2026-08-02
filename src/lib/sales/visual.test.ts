import { describe, expect, it } from "vitest";

import { VISUAL_SCHEMA_KEYS } from "@/lib/sales/auditor";
import { buildUserContent } from "@/lib/sales/model";
import { salesScreenshotKey } from "@/lib/sales/screenshot";
import { isVisualBreakdown, VISUAL_DIMENSIONS } from "@/lib/sales/visual";

describe("vizuální dimenze", () => {
  it("drží všech 10 dimenzí ze specifikace 9.1", () => {
    expect(VISUAL_DIMENSIONS).toHaveLength(10);
    const keys = VISUAL_DIMENSIONS.map((dimension) => dimension.key);
    expect(new Set(keys).size).toBe(10);
  });

  it("Zod schéma auditora má stejné klíče jako seznam dimenzí", () => {
    const keys = VISUAL_DIMENSIONS.map((dimension) => dimension.key);
    expect([...VISUAL_SCHEMA_KEYS].sort()).toEqual([...keys].sort());
  });

  it("isVisualBreakdown pozná kompletní rozpad a odmítne neúplný", () => {
    const complete = Object.fromEntries(
      VISUAL_DIMENSIONS.map((dimension) => [dimension.key, 5]),
    );
    expect(isVisualBreakdown(complete)).toBe(true);
    expect(isVisualBreakdown({ typography: 5 })).toBe(false);
    expect(isVisualBreakdown(null)).toBe(false);
    expect(isVisualBreakdown("text")).toBe(false);
  });
});

describe("screenshoty", () => {
  it("klíč v úložišti je deterministický podle leadu a druhu", () => {
    expect(salesScreenshotKey("lead1", "desktop")).toBe(
      "sales/lead1/desktop.jpg",
    );
    expect(salesScreenshotKey("lead1", "mobile")).toBe("sales/lead1/mobile.jpg");
  });
});

describe("multimodální vstup modelu", () => {
  it("bez obrázků zůstává prostý text", () => {
    expect(buildUserContent("ahoj", [])).toBe("ahoj");
  });

  it("s obrázky vzniká pole částí s data URL", () => {
    const content = buildUserContent("audit", [
      { label: "desktop", data: Buffer.from("obrazek"), mimeType: "image/jpeg" },
    ]);
    expect(Array.isArray(content)).toBe(true);
    const parts = content as Exclude<typeof content, string>;
    expect(parts[0]).toEqual({ type: "input_text", text: "audit" });
    expect(parts[1]).toMatchObject({ type: "input_image", detail: "auto" });
    const imagePart = parts[1] as { image_url: string };
    expect(imagePart.image_url.startsWith("data:image/jpeg;base64,")).toBe(
      true,
    );
    expect(imagePart.image_url).toContain(
      Buffer.from("obrazek").toString("base64"),
    );
  });
});
