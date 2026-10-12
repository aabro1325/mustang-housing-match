import type { Preferences, SavedListing } from "@/core/domain";
import { fitScore } from "@/core/scoring";
import { Button } from "../../components/Button";
import { Notice } from "../../components/Notice";
import { ScorecardScreen } from "../match/ScorecardScreen";
import { STATUS_LABEL } from "./savedView";

/**
 * A Saved Listing, read-only, scored against this Member's Preferences. Build 7 extends this screen with
 * Status, Tour, Notes, Landlord Questions and the Finalist toggle.
 */
export function SavedDetail({ saved, prefs, onBack }: { saved: SavedListing; prefs: Preferences | null; onBack: () => void }) {
  if (!prefs) {
    return (
      <div class="stack">
        <Button variant="link" onClick={onBack}>← Back to saved</Button>
        <Notice tone="info">Set your preferences on the Match tab to score this listing.</Notice>
      </div>
    );
  }
  const result = fitScore(saved.listing.facts, saved.commute, prefs);
  return (
    <div class="stack">
      <div class="row row--between">
        <Button variant="link" onClick={onBack}>← Back to saved</Button>
        <span class={`statuschip statuschip--${saved.status}`}>{STATUS_LABEL[saved.status]}</span>
      </div>
      <ScorecardScreen
        readOnly
        context="Saved listing"
        listing={saved.listing}
        result={result}
        prefs={prefs}
        commute={saved.commute ? { status: "done", value: saved.commute } : { status: "idle" }}
        save={{ status: "idle" }}
        onSave={() => {}}
        onEdit={() => {}}
        onRetryCommute={() => {}}
        onEditAddress={() => {}}
        onAnother={() => {}}
        onPreferences={() => {}}
      />
    </div>
  );
}
