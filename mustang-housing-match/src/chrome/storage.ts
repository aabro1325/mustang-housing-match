// Thin wrappers over chrome.storage so the rest of the app can be tested with an in-memory substitute.
export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

export function chromeStore(area: "local" | "sync" | "session"): KeyValueStore {
  const a = chrome.storage[area];
  return {
    async get<T>(key: string) {
      const r = await a.get(key);
      return r[key] as T | undefined;
    },
    async set<T>(key: string, value: T) {
      await a.set({ [key]: value });
    },
    async remove(key: string) {
      await a.remove(key);
    },
  };
}

export function memoryStore(): KeyValueStore {
  const m = new Map<string, unknown>();
  return {
    async get<T>(key: string) { return m.get(key) as T | undefined; },
    async set<T>(key: string, value: T) { m.set(key, value); },
    async remove(key: string) { m.delete(key); },
  };
}
