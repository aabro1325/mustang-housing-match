export async function runCaptureScript<T>(tabId: number): Promise<T> {
  const results = await chrome.scripting.executeScript({ target: { tabId }, files: ["capture.js"] });
  const first = results[0];
  if (!first) throw new Error("Capture script returned nothing");
  return first.result as T;
}

/** The text the student has selected on the page (for Text Listings). Empty string when nothing is selected. */
export async function selectedText(tabId: number): Promise<string> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => globalThis.getSelection()?.toString() ?? "",
  });
  return (results[0]?.result as string | undefined) ?? "";
}
