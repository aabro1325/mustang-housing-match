import type { Commute } from "../domain";
import { REFERENCE_POINT_VERSION } from "./referencePoint";
import type { CommuteProvider } from "./provider";

export interface CommuteCache {
  get(key: string): Promise<Commute | undefined>;
  set(key: string, commute: Commute): Promise<void>;
}

export function commuteCacheKey(normalizedAddress: string, version: number): string {
  return `commute:v${version}:${normalizedAddress}`;
}

/** Wraps a provider with a cache keyed by normalised address. Permanent outcomes are cached forever; transient failures never. */
export function cachedProvider(inner: CommuteProvider, cache: CommuteCache, normalize: (address: string) => string): CommuteProvider {
  return {
    id: inner.id,
    async lookup(address, opts) {
      const key = commuteCacheKey(normalize(address), REFERENCE_POINT_VERSION);
      const hit = await cache.get(key);
      if (hit && hit.referencePointVersion === REFERENCE_POINT_VERSION && hit.kind !== "transient-failure") return hit;
      const result = await inner.lookup(address, opts);
      if (result.kind !== "transient-failure") await cache.set(key, result);
      return result;
    },
  };
}
