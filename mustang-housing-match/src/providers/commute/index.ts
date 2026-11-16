import type { CommuteProvider } from "../../core/commute/provider";
import { COMMUTE_NOT_CONFIGURED } from "../../core/commute/messages";
import { REFERENCE_POINT_VERSION } from "../../core/commute/referencePoint";
import { fixtureCommuteProvider } from "./fixture";
import { orsTransitlandProvider } from "./orsTransitland";

export interface CommuteEnv {
  VITE_COMMUTE_PROVIDER?: string;
  VITE_ORS_API_KEY?: string;
  VITE_TRANSITLAND_API_KEY?: string;
}

export interface CommuteDeps {
  fetch: typeof fetch;
  /** Keys saved from the options page. Preferred over build-time env so the store package can ship without secrets. */
  keys?: () => Promise<{ orsKey: string; transitlandKey: string }>;
}

/**
 * `fixture` (the default) is deterministic and offline.
 * `live` calls openrouteservice and Transitland. Missing keys return a Commute Failure the panel can explain.
 * They do not fall back to fixture numbers, which would look like a real commute.
 */
export function createCommuteProvider(env: CommuteEnv, deps: CommuteDeps): CommuteProvider {
  if (env.VITE_COMMUTE_PROVIDER !== "live") return fixtureCommuteProvider();
  return {
    id: "ors-transitland",
    async lookup(address, opts) {
      let orsKey = "";
      let transitlandKey = "";
      if (deps.keys) {
        try {
          const stored = await deps.keys();
          orsKey = stored.orsKey.trim();
          transitlandKey = stored.transitlandKey.trim();
        } catch (e) {
          return {
            kind: "transient-failure",
            message: e instanceof Error ? e.message : "Couldn't read saved commute keys.",
            referencePointVersion: REFERENCE_POINT_VERSION,
          };
        }
      }
      if (!orsKey) orsKey = env.VITE_ORS_API_KEY?.trim() ?? "";
      if (!transitlandKey) transitlandKey = env.VITE_TRANSITLAND_API_KEY?.trim() ?? "";
      if (!orsKey || !transitlandKey) {
        return { kind: "transient-failure", message: COMMUTE_NOT_CONFIGURED, referencePointVersion: REFERENCE_POINT_VERSION };
      }
      return orsTransitlandProvider({ orsKey, transitlandKey, fetch: deps.fetch }).lookup(address, opts);
    },
  };
}

export { fixtureCommuteProvider } from "./fixture";
export { orsTransitlandProvider } from "./orsTransitland";
export { COMMUTE_NOT_CONFIGURED } from "../../core/commute/messages";
