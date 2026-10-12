import { useState } from "preact/hooks";
import { STATUSES, type SavedListing, type Status } from "@/core/domain";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Section } from "../../components/Section";
import { STATUS_LABEL } from "./savedView";
import { formatTour, isoToLocalInput, localInputToIso } from "./dates";

/** Status, tour and the Compare (Finalist) toggle for one Saved Listing. Every change goes through the controller. */
export function DecisionPanel({ saved, onStatus, onTour, onToggleFinalist }: {
  saved: SavedListing;
  onStatus: (s: Status) => void;
  onTour: (iso: string | null) => void;
  onToggleFinalist: () => void;
}) {
  const [editingTour, setEditingTour] = useState(saved.tourAt === null ? false : false);
  const [draft, setDraft] = useState(isoToLocalInput(saved.tourAt));
  const canSuggestTourStatus = saved.tourAt !== null && (saved.status === "saved" || saved.status === "considering");

  function commitTour() {
    onTour(localInputToIso(draft));
    setEditingTour(false);
  }

  return (
    <Section title="Where this one stands" id="decision">
      <Card>
        <div class="decision__label" id="status-label">Status</div>
        <div class="statusrow" role="radiogroup" aria-labelledby="status-label">
          {STATUSES.map((st) => (
            <button
              key={st}
              type="button"
              role="radio"
              aria-checked={saved.status === st}
              class={`statuschip statuschip--pick ${saved.status === st ? `statuschip--${st} statuschip--on` : ""}`}
              onClick={() => onStatus(st)}
            >
              {STATUS_LABEL[st]}
            </button>
          ))}
        </div>

        <div class="decision__row">
          <div class="decision__label">Tour</div>
          {editingTour ? (
            <div class="tour-edit">
              <input
                type="datetime-local"
                class="tour-edit__input"
                aria-label="Tour date and time"
                value={draft}
                onInput={(e) => setDraft((e.currentTarget as HTMLInputElement).value)}
              />
              <div class="row">
                <Button variant="secondary" size="sm" onClick={commitTour}>Save tour</Button>
                <Button variant="ghost" size="sm" onClick={() => { setDraft(isoToLocalInput(saved.tourAt)); setEditingTour(false); }}>Cancel</Button>
              </div>
            </div>
          ) : saved.tourAt ? (
            <div class="tour">
              <span class="tour__when">Tour: {formatTour(saved.tourAt)}</span>
              <span class="row">
                <Button variant="ghost" size="sm" onClick={() => { setDraft(isoToLocalInput(saved.tourAt)); setEditingTour(true); }}>Change</Button>
                <Button variant="ghost" size="sm" onClick={() => onTour(null)} aria-label="Clear tour">Clear</Button>
              </span>
            </div>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setEditingTour(true)}>Add a tour date</Button>
          )}
          {canSuggestTourStatus && (
            <p class="fine">Touring soon? <Button variant="link" onClick={() => onStatus("tour-scheduled")}>Mark as Tour scheduled</Button></p>
          )}
        </div>

        <div class="decision__row decision__row--split">
          <div>
            <div class="decision__label">Compare</div>
            <p class="small muted">{saved.finalist ? "In the side-by-side on the Compare tab." : "Mark a finalist to compare it side by side."}</p>
          </div>
          <Button variant={saved.finalist ? "primary" : "secondary"} size="sm" aria-pressed={saved.finalist} onClick={onToggleFinalist}>
            {saved.finalist ? "In Compare" : "Add to Compare"}
          </Button>
        </div>
      </Card>
    </Section>
  );
}
