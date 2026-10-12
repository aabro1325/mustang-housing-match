// Opt-in live check against openrouteservice and Transitland with the keys in .env.
// Run: MHM_LIVE=1 npx vitest run src/providers/commute/live.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { createCommuteProvider } from "./index";

const live = process.env.MHM_LIVE === "1" && existsSync(".env");

describe.skipIf(!live)("live commute lookup", () => {
  it("geocodes and routes a real San Luis Obispo address", async () => {
    const env: Record<string, string> = {};
    for (const line of readFileSync(".env", "utf8").split("\n")) {
      const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
      if (m) env[m[1]!] = m[2]!;
    }
    const provider = createCommuteProvider({ ...env, VITE_COMMUTE_PROVIDER: "live" }, { fetch });
    expect(provider.id).toBe("ors-transitland");
    const result = await provider.lookup("870 Foothill Blvd, San Luis Obispo, CA 93405", { now: new Date() });
    console.log(JSON.stringify(result, null, 2));
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.modes.bike.kind).toBe("ok");
      expect(result.modes.car.kind).toBe("ok");
      expect(result.modes.walk.kind).toBe("ok");
    }
  }, 60_000);
});
