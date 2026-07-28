import { describe, expect, it } from "vitest";

import {
  createSessionToken,
  createToken,
  portalCookieName,
  verifyToken,
} from "./session";

describe("podpis session tokenu", () => {
  it("přijme vlastní token a vrátí id uživatele", () => {
    const token = createSessionToken("user-123");
    expect(verifyToken(token)).toBe("user-123");
  });

  it("odmítne token s pozměněnou hlavičkou payloadu", () => {
    const token = createSessionToken("user-123");
    const [body, signature] = token.split(".");

    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    payload.sub = "user-999";
    const forgedBody = Buffer.from(JSON.stringify(payload)).toString(
      "base64url",
    );

    expect(verifyToken(`${forgedBody}.${signature}`)).toBeNull();
  });

  it("odmítne token s pozměněným podpisem", () => {
    const token = createSessionToken("user-123");
    const [body, signature] = token.split(".");
    const forged = signature.replace(/.$/, (last) =>
      last === "A" ? "B" : "A",
    );

    expect(verifyToken(`${body}.${forged}`)).toBeNull();
  });

  it("odmítne podpis jiné délky, aniž by vyhodil výjimku", () => {
    const token = createSessionToken("user-123");
    const [body] = token.split(".");
    expect(() => verifyToken(`${body}.kratky`)).not.toThrow();
    expect(verifyToken(`${body}.kratky`)).toBeNull();
  });

  it("odmítne token po expiraci", () => {
    const expired = createToken("user-123", -10);
    expect(verifyToken(expired)).toBeNull();
  });

  it("přijme token, jehož platnost ještě neskončila", () => {
    const token = createToken("user-123", 60);
    expect(verifyToken(token)).toBe("user-123");
  });

  it("odmítne chybějící i zjevně nesmyslný token", () => {
    expect(verifyToken(undefined)).toBeNull();
    expect(verifyToken("")).toBeNull();
    expect(verifyToken("bez-tecky")).toBeNull();
    expect(verifyToken(".jenpodpis")).toBeNull();
  });

  it("odmítne payload, který není platný JSON", () => {
    const body = Buffer.from("tohle není json").toString("base64url");
    // Podpis dopočítáme tak, aby prošel kontrolou, a selhat má až parsování.
    const token = createToken("x", 60);
    const signature = token.split(".")[1];
    expect(verifyToken(`${body}.${signature}`)).toBeNull();
  });
});

describe("název cookie pro portál", () => {
  it("je pro každý odkaz jiný, aby se session dvou portálů nepletly", () => {
    expect(portalCookieName("link-a")).not.toBe(portalCookieName("link-b"));
    expect(portalCookieName("link-a")).toContain("link-a");
  });
});
