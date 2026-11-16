/** chrome.storage.local keys for commute APIs. Never log the values. */
export const ORS_KEY_STORAGE = "mhm.orsApiKey";
export const TRANSITLAND_KEY_STORAGE = "mhm.transitlandApiKey";

export interface CommuteKeys {
  orsKey: string;
  transitlandKey: string;
}

export async function readCommuteKeys(): Promise<CommuteKeys> {
  const data = await chrome.storage.local.get([ORS_KEY_STORAGE, TRANSITLAND_KEY_STORAGE]);
  const ors = data[ORS_KEY_STORAGE];
  const transit = data[TRANSITLAND_KEY_STORAGE];
  return {
    orsKey: typeof ors === "string" ? ors.trim() : "",
    transitlandKey: typeof transit === "string" ? transit.trim() : "",
  };
}

export async function writeCommuteKeys(keys: CommuteKeys): Promise<void> {
  await chrome.storage.local.set({
    [ORS_KEY_STORAGE]: keys.orsKey.trim(),
    [TRANSITLAND_KEY_STORAGE]: keys.transitlandKey.trim(),
  });
}
