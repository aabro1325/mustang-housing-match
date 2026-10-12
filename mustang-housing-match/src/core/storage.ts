/** A tiny async key-value store. Implemented by chrome.storage areas in src/chrome and by memoryStore in tests. */
export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

export function memoryStore(seed?: Record<string, unknown>): KeyValueStore {
  const m = new Map<string, unknown>(Object.entries(seed ?? {}));
  return {
    async get<T>(key: string) { return m.get(key) as T | undefined; },
    async set<T>(key: string, value: T) { m.set(key, structuredClone(value)); },
    async remove(key: string) { m.delete(key); },
  };
}
