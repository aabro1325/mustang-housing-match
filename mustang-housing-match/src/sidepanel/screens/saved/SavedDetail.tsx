import type { Preferences, SavedListing, Status } from "@/core/domain";
import { fitScore } from "@/core/scoring";
import { Button } from "../../components/Button";
import { Notice } from "../../components/Notice";
import { ScorecardScreen, scoreBand } from "../match/ScorecardScreen";
import { SOURCE_LABEL } from "../../state/match";
import { STATUS_LABEL } from "./savedView";
import { DecisionPanel } from "./DecisionPanel";
import { NotesPanel } from "./NotesPanel";
import { QuestionsPanel } from "./QuestionsPanel";

export interface SavedDetailActions {
  onStatus: (status: Status) => void;
  onTour: (iso: string | null) => void;
  onToggleFinalist: () => void;
  onAddNote: (text: string) => void;
  onQuestions: (next: string[]) => void;
}

/**
 * One Saved Listing: where it stands (Status, Tour, Compare), the group's notes and landlord questions, then the
 * Scorecard scored against this Member's Preferences.
 */
export function SavedDetail({ saved, prefs, onBack, actions }: { saved: SavedListing; prefs: Preferences | null; onBack: () => void; actions: SavedDetailActions }) {
  const result = prefs ? fitScore(saved.listing.facts, saved.commute, prefs) : null;
  return (
    <div class="stack">
      <div class="row row--between">
        <Button variant="link" onClick={onBack}>← Back to saved</Button>
        <span class={`statuschip statuschip--${saved.status}`}>{STATUS_LABEL[saved.status]}</span>
      </div>

      <div class="detailhead">
        <p class="detailhead__source">{SOURCE_LABEL[saved.listing.source]}</p>
        <h1 class="detailhead__title">{saved.listing.title}</h1>
        {result && (
          <p class="detailhead__score">
            <span class={`scoretag scoretag--${result.score >= 80 ? "strong" : result.score >= 60 ? "solid" : "weak"}`}>{result.score} · {scoreBand(result.score).label}</span>
            <span class="small muted"> for your preferences</span>
          </p>
        )}
      </div>

      <DecisionPanel saved={saved} onStatus={actions.onStatus} onTour={actions.onTour} onToggleFinalist={actions.onToggleFinalist} />
      <NotesPanel notes={saved.notes} onAdd={actions.onAddNote} />
      <QuestionsPanel questions={saved.landlordQuestions} onChange={actions.onQuestions} />

      {!prefs || !result ? (
        <Notice tone="info">Set your preferences on the Match tab to score this listing.</Notice>
      ) : (
        <ScorecardScreen
          readOnly
          hideQuestions
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
      )}
    </div>
  );
}
