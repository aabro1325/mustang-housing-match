import { describe, it, expect } from "vitest";
import { buildInviteLink, buildInviteCode, parseInvite, randomToken } from "./invite";

describe("invitation links", () => {
  it("round-trips a full link", () => {
    const link = buildInviteLink("https://example.test/join/", "abc-123", "deadbeef");
    expect(link).toBe("https://example.test/join/#list=abc-123&t=deadbeef");
    expect(parseInvite(link)).toEqual({ listId: "abc-123", token: "deadbeef" });
  });
  it("adds a slash to a bare base", () => {
    expect(buildInviteLink("https://example.test/join", "l", "t")).toBe("https://example.test/join/#list=l&t=t");
  });
  it("accepts the bare code", () => {
    expect(parseInvite(buildInviteCode("abc", "tok"))).toEqual({ listId: "abc", token: "tok" });
    expect(parseInvite("  abc.tok \n")).toEqual({ listId: "abc", token: "tok" });
  });
  it("rejects garbage", () => {
    expect(parseInvite("")).toBeNull();
    expect(parseInvite("hello")).toBeNull();
    expect(parseInvite("https://x/#list=only")).toBeNull();
  });
  it("makes hex tokens of the requested length", () => {
    expect(randomToken(4, (n) => new Uint8Array(n).fill(255))).toBe("ffffffff");
    expect(randomToken()).toMatch(/^[0-9a-f]{64}$/);
  });
});
