import { describe, expect, it } from "vitest";

import {
  MAX_PIN_ATTEMPTS,
  generatePin,
  generatePortalToken,
  hashPortalToken,
  isLinkUsable,
  isLocked,
} from "./portal";

describe("portálový token", () => {
  it("je dostatečně dlouhý a pokaždé jiný", () => {
    const a = generatePortalToken();
    const b = generatePortalToken();

    expect(a).not.toBe(b);
    // 32 bajtů v base64url dává 43 znaků.
    expect(a.length).toBeGreaterThanOrEqual(43);
  });

  it("neobsahuje znaky, které by se v URL musely kódovat", () => {
    for (let i = 0; i < 50; i++) {
      expect(generatePortalToken()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("se hashuje deterministicky, aby šel odkaz dohledat", () => {
    const token = generatePortalToken();
    expect(hashPortalToken(token)).toBe(hashPortalToken(token));
  });

  it("dává pro různé tokeny různé hashe a hash není token sám", () => {
    const token = generatePortalToken();
    expect(hashPortalToken(token)).not.toBe(token);
    expect(hashPortalToken(token)).not.toBe(
      hashPortalToken(generatePortalToken()),
    );
  });
});

describe("PIN", () => {
  it("má vždy šest číslic včetně vedoucích nul", () => {
    for (let i = 0; i < 200; i++) {
      expect(generatePin()).toMatch(/^\d{6}$/);
    }
  });

  it("povoluje nejvýše pět pokusů", () => {
    expect(MAX_PIN_ATTEMPTS).toBe(5);
  });
});

describe("použitelnost odkazu", () => {
  const hour = 3_600_000;

  it("platí, když je aktivní a bez expirace", () => {
    expect(isLinkUsable({ active: true, expiresAt: null })).toBe(true);
  });

  it("neplatí, když byl zneplatněn", () => {
    expect(isLinkUsable({ active: false, expiresAt: null })).toBe(false);
  });

  it("neplatí po vypršení platnosti", () => {
    expect(
      isLinkUsable({ active: true, expiresAt: new Date(Date.now() - hour) }),
    ).toBe(false);
  });

  it("platí, dokud expirace nenastane", () => {
    expect(
      isLinkUsable({ active: true, expiresAt: new Date(Date.now() + hour) }),
    ).toBe(true);
  });

  it("zneplatnění má přednost před dosud platnou expirací", () => {
    expect(
      isLinkUsable({ active: false, expiresAt: new Date(Date.now() + hour) }),
    ).toBe(false);
  });
});

describe("zamčení po neúspěšných pokusech", () => {
  it("je zamčeno, dokud čas zámku neuplyne", () => {
    expect(isLocked({ lockedUntil: new Date(Date.now() + 60_000) })).toBe(true);
  });

  it("není zamčeno, když zámek vypršel", () => {
    expect(isLocked({ lockedUntil: new Date(Date.now() - 60_000) })).toBe(false);
  });

  it("není zamčeno, když zámek nikdy nebyl nastaven", () => {
    expect(isLocked({ lockedUntil: null })).toBe(false);
  });
});
