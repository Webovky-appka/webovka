import { describe, expect, it } from "vitest";

import { PasswordChangeSchema, PinSchema } from "./validation";

function firstError(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): string | null {
  const result = PasswordChangeSchema.safeParse(input);
  return result.success ? null : (result.error.issues[0]?.message ?? "");
}

describe("změna hesla", () => {
  it("projde u dostatečně dlouhého a shodně potvrzeného hesla", () => {
    expect(
      firstError({
        currentPassword: "stareheslo",
        newPassword: "noveheslo123",
        confirmPassword: "noveheslo123",
      }),
    ).toBeNull();
  });

  it("odmítne heslo kratší než deset znaků", () => {
    expect(
      firstError({
        currentPassword: "stareheslo",
        newPassword: "kratke",
        confirmPassword: "kratke",
      }),
    ).toBe("Nové heslo musí mít alespoň 10 znaků.");
  });

  it("odmítne neshodné potvrzení", () => {
    expect(
      firstError({
        currentPassword: "stareheslo",
        newPassword: "noveheslo123",
        confirmPassword: "jinepotvrzeni",
      }),
    ).toBe("Nové heslo a jeho potvrzení se neshodují.");
  });

  it("odmítne nastavení stejného hesla, jaké už platí", () => {
    expect(
      firstError({
        currentPassword: "stejneheslo123",
        newPassword: "stejneheslo123",
        confirmPassword: "stejneheslo123",
      }),
    ).toBe("Nové heslo se musí lišit od současného.");
  });

  it("vyžaduje zadání současného hesla", () => {
    expect(
      firstError({
        currentPassword: "",
        newPassword: "noveheslo123",
        confirmPassword: "noveheslo123",
      }),
    ).toBe("Zadejte současné heslo.");
  });

  it("odmítne nesmyslně dlouhé heslo", () => {
    expect(
      firstError({
        currentPassword: "stareheslo",
        newPassword: "a".repeat(201),
        confirmPassword: "a".repeat(201),
      }),
    ).toBe("Heslo je příliš dlouhé.");
  });
});

describe("PIN z portálu", () => {
  it("přijme šest číslic", () => {
    expect(PinSchema.safeParse({ token: "t", pin: "012345" }).success).toBe(
      true,
    );
  });

  it("odmítne jiný počet číslic i jiné znaky", () => {
    const invalid = ["12345", "1234567", "12a456", "", "  ", "12 456"];
    for (const pin of invalid) {
      expect(PinSchema.safeParse({ token: "t", pin }).success).toBe(false);
    }
  });

  it("odmítne prázdný token", () => {
    expect(PinSchema.safeParse({ token: "", pin: "123456" }).success).toBe(
      false,
    );
  });
});
