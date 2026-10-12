import { detectSource } from "@/core/supportedPage";
import { readApartments } from "./apartments";
import { readCraigslist } from "./craigslist";
import { readZillow } from "./zillow";
import type { RawCapture } from "./types";

export type { RawCapture } from "./types";

/** Captures the Listing Facts of the page. Never throws: failures come back as warnings. */
export function capturePage(doc: Document, url: string): RawCapture {
  const detected = detectSource(url);
  if (!detected) return { url, title: doc.title, source: "unsupported", warnings: [] };
  try {
    switch (detected.source) {
      case "zillow":
        return readZillow(doc, url, detected.kind === "building" ? "building" : "home");
      case "craigslist":
        return readCraigslist(doc, url);
      case "apartments":
        return readApartments(doc, url);
    }
  } catch (e) {
    return { url, title: doc.title, source: detected.source, kind: detected.kind, warnings: [`Capture failed: ${e instanceof Error ? e.message : String(e)}`] };
  }
}
