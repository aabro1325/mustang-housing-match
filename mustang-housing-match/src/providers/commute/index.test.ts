import { describe, it, expect } from "vitest";
import { COMMUTE_NOT_CONFIGURED } from "@/core/commute/messages";
import { createCommuteProvider } from "./index";

const f = (async () => new Response("{}")) as unknown as typeof fetch;

describe("createCommuteProvider", () => {
  it("defaults to the fixture unless the build asks for live lookups", () => {
    expect(createCommuteProvider({}, { fetch: f }).id).toBe("fixture");
    expect(createCommuteProvider({ VITE_COMMUTE_PROVIDER: "fixture" }, { fetch: f }).id).toBe("fixture");
  });

  it("does not invent fixture times when live keys are missing", async () => {
    const provider = createCommuteProvider({ VITE_COMMUTE_PROVIDER: "live" }, { fetch: f });
    expect(provider.id).toBe("ors-transitland");
    const result = await provider.lookup("870 Foothill Blvd", { now: new Date("2026-11-16T16:00:00Z") });
    expect(result.kind).toBe("transient-failure");
    if (result.kind === "transient-failure") expect(result.message).toBe(COMMUTE_NOT_CONFIGURED);
  });

  it("uses keys saved at runtime instead of build-time placeholders", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    const provider = createCommuteProvider({ VITE_COMMUTE_PROVIDER: "live", VITE_ORS_API_KEY: "", VITE_TRANSITLAND_API_KEY: "" }, {
      fetch: fetchImpl,
      keys: async () => ({ orsKey: "stored-ors", transitlandKey: "stored-transit" }),
    });
    await provider.lookup("870 Foothill Blvd", { now: new Date("2026-11-16T16:00:00Z") });
    expect(calls).toBeGreaterThan(0);
  });
});
