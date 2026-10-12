import type { KeyValueStore } from "@/core/storage";
export type { KeyValueStore } from "@/core/storage";
export { memoryStore } from "@/core/storage";

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
