import { describe, it, expect } from "vitest";
import { createCommuteProvider } from "./index";

const f = (async () => new Response("{}")) as unknown as typeof fetch;

describe("createCommuteProvider", () => {
  it("defaults to the fixture", () => {
    expect(createCommuteProvider({}, { fetch: f }).id).toBe("fixture");
    expect(createCommuteProvider({ VITE_COMMUTE_PROVIDER: "live" }, { fetch: f }).id).toBe("fixture");
    expect(createCommuteProvider({ VITE_COMMUTE_PROVIDER: "live", VITE_ORS_API_KEY: "a" }, { fetch: f }).id).toBe("fixture");
  });
  it("selects live when asked and both keys exist", () => {
    expect(createCommuteProvider({ VITE_COMMUTE_PROVIDER: "live", VITE_ORS_API_KEY: "a", VITE_TRANSITLAND_API_KEY: "b" }, { fetch: f }).id).toBe("ors-transitland");
  });
});
