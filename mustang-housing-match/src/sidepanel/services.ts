import type { KeyValueStore } from "@/core/storage";
import type { CommuteProvider } from "@/core/commute/provider";
import { cachedProvider } from "@/core/commute/cache";
import { normalizeAddress } from "@/core/address";
import type { SharingProvider } from "@/core/sharing/provider";
import type { RawCapture } from "@/capture/readers/types";
import type { ActiveTab } from "@/chrome/tabs";

/** Everything the panel touches outside pure code. Tests pass fakes; `createServices` wires Chrome. */
export interface Services {
  /** chrome.storage.sync: Preferences and the onboarding flag. */
  sync: KeyValueStore;
  /** chrome.storage.local: Commute cache, current list id, local Shared Lists. */
  local: KeyValueStore;
  commute: CommuteProvider;
  sharing: SharingProvider;
  tabs: {
    listingTab(): Promise<ActiveTab | undefined>;
    onChange(cb: () => void): () => void;
  };
  capture(tabId: number): Promise<RawCapture>;
  selectedText(tabId: number): Promise<string>;
  now(): Date;
}

export const KEYS = {
  preferences: "mhm.preferences",
  onboarded: "mhm.onboarded",
  currentListId: "mhm.currentListId",
} as const;

let instance: Services | undefined;

/** Lazily wires the real Chrome-backed services. Only called from the panel entry point. */
export async function createServices(): Promise<Services> {
  if (instance) return instance;
  const [{ chromeStore }, tabs, scripting, { createCommuteProvider }, { localSharingProvider }] = await Promise.all([
    import("@/chrome/storage"),
    import("@/chrome/tabs"),
    import("@/chrome/scripting"),
    import("@/providers/commute/index"),
    import("@/providers/sharing/local"),
  ]);
  const local = chromeStore("local");
  const sync = chromeStore("sync");
  const env = import.meta.env as Record<string, string | undefined>;
  const commute = cachedProvider(
    createCommuteProvider(env, { fetch: globalThis.fetch.bind(globalThis) }),
    { get: (k) => local.get(k), set: (k, v) => local.set(k, v) },
    normalizeAddress,
  );
  let sharing: SharingProvider;
  if (env.VITE_SHARING_PROVIDER === "appsync" && env.VITE_APPSYNC_GRAPHQL_ENDPOINT) {
    const { createAppSyncSharing } = await import("./appsyncSharing");
    sharing = await createAppSyncSharing(env, local);
  } else {
    sharing = localSharingProvider({ store: local });
  }
  instance = {
    sync,
    local,
    commute,
    sharing,
    tabs: { listingTab: tabs.listingTab, onChange: tabs.onActiveTabChanged },
    capture: (tabId) => scripting.runCaptureScript<RawCapture>(tabId),
    selectedText: scripting.selectedText,
    now: () => new Date(),
  };
  return instance;
}
