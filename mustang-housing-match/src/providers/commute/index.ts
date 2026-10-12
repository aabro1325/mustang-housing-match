import type { CommuteProvider } from "../../core/commute/provider";
import { fixtureCommuteProvider } from "./fixture";
import { orsTransitlandProvider } from "./orsTransitland";

export interface CommuteEnv {
  VITE_COMMUTE_PROVIDER?: string;
  VITE_ORS_API_KEY?: string;
  VITE_TRANSITLAND_API_KEY?: string;
}

/** `live` with both keys present selects openrouteservice + Transitland; anything else is the fixture. */
export function createCommuteProvider(env: CommuteEnv, deps: { fetch: typeof fetch }): CommuteProvider {
  const orsKey = env.VITE_ORS_API_KEY?.trim();
  const transitlandKey = env.VITE_TRANSITLAND_API_KEY?.trim();
  if (env.VITE_COMMUTE_PROVIDER === "live" && orsKey && transitlandKey) {
    return orsTransitlandProvider({ orsKey, transitlandKey, fetch: deps.fetch });
  }
  return fixtureCommuteProvider();
}

export { fixtureCommuteProvider } from "./fixture";
export { orsTransitlandProvider } from "./orsTransitland";
