import type { FloorPlan, ListingFacts, SourceId } from "@/core/domain";

/** What the capture script returns through chrome.scripting.executeScript. Must stay JSON-serialisable. */
export interface RawCapture {
  url: string;
  title: string;
  source: SourceId | "unsupported";
  kind?: string;
  facts?: ListingFacts;
  /** Present on multi-plan pages; the Review step's Floor Plan picker chooses one. */
  floorPlans?: FloorPlan[];
  warnings: string[];
}
