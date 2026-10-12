import { TRANSPORT_MODES, type Category, type Commute, type Listing, type ModeResult, type Preferences, type TransportMode } from "@/core/domain";
import { LEASE_LABEL, MODE_LABEL, type FitScoreResult } from "@/core/scoring";
import { landlordQuestions } from "@/core/cost";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { CategoryBar } from "../../components/CategoryBar";
import { Header } from "../../components/Header";
import { Notice } from "../../components/Notice";
import { ProvenanceTag } from "../../components/ProvenanceTag";
import { ScoreRing } from "../../components/ScoreRing";
import { Section } from "../../components/Section";
import { WalkIcon, BikeIcon, BusIcon, CarIcon } from "../../components/icons";
import { SOURCE_LABEL, type CommuteState, type SaveState } from "../../state/match";

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const PRIORITY_TEXT = { low: "low priority", med: "medium priority", high: "high priority" } as const;
const CATEGORY_TEXT: Record<Category, string> = { cost: "Cost", commute: "Commute", lease: "Lease", amenities: "Amenities" };
const MODE_ICON: Record<TransportMode, () => preact.JSX.Element> = { walk: WalkIcon, bike: BikeIcon, bus: BusIcon, car: CarIcon };

export function scoreBand(score: number): { title: string; label: string } {
  if (score >= 80) return { title: "A strong fit", label: "Strong match" };
  if (score >= 60) return { title: "A solid fit, with tradeoffs", label: "Solid match" };
  return { title: "A stretch for your priorities", label: "Weak match" };
}

function summary(r: FitScoreResult, prefs: Preferences, commute: Commute | null): string {
  const parts: string[] = [];
  if (r.estimatedMonthlyTotal !== null && prefs.budget) parts.push(r.estimatedMonthlyTotal <= prefs.budget ? "Within budget." : "Over budget.");
  const m = commute?.kind === "ok" ? commute.modes[prefs.transportMode] : null;
  if (m?.kind === "ok") parts.push(`${Math.round(m.minutes)} min ${MODE_LABEL[prefs.transportMode].toLowerCase()} to campus.`);
  if (r.watchOuts[0]) parts.push(r.watchOuts[0].text.replace(/;.*$/, "") + ".");
  return parts.slice(0, 3).join(" ");
}

function categoryDetail(c: Category, r: FitScoreResult, prefs: Preferences, listing: Listing, commute: Commute | null): string {
  switch (c) {
    case "cost":
      return r.estimatedMonthlyTotal === null ? "Rent not listed, so cost scores half." : prefs.budget ? `${money(r.estimatedMonthlyTotal)} estimated total against your ${money(prefs.budget)} cap.` : `${money(r.estimatedMonthlyTotal)} estimated total; set a budget to score it.`;
    case "commute": {
      if (!commute) return "Looking up the commute…";
      if (commute.kind === "address-not-found") return "Address could not be located.";
      if (commute.kind === "transient-failure") return "Commute lookup failed.";
      const m = commute.modes[prefs.transportMode];
      return m.kind === "ok" ? `${Math.round(m.minutes)} min by ${MODE_LABEL[prefs.transportMode].toLowerCase()}; your limit is ${prefs.maxCommuteMinutes}.` : `No ${MODE_LABEL[prefs.transportMode].toLowerCase()} route found.`;
    }
    case "lease": {
      const l = listing.facts.leaseType.value;
      return l === null ? "Lease length not listed." : `${LEASE_LABEL[l]} lease; you prefer ${LEASE_LABEL[prefs.leaseType]!.toLowerCase()}.`;
    }
    case "amenities": {
      if (prefs.wantedAmenities.length === 0) return "No must-haves set.";
      const have = prefs.wantedAmenities.filter((a) => listing.facts.amenities[a].value === true).length;
      return `${have} of ${prefs.wantedAmenities.length} wanted amenities listed.`;
    }
  }
}

function ModeTile({ mode, result, preferred }: { mode: TransportMode; result: ModeResult; preferred: boolean }) {
  const Icon = MODE_ICON[mode];
  return (
    <div class={`mode ${preferred ? "mode--preferred" : ""}`} aria-label={`${MODE_LABEL[mode]}${preferred ? " (your mode)" : ""}`}>
      <Icon />
      <span class="mode__label">{MODE_LABEL[mode]}</span>
      {result.kind === "ok" ? (
        <>
          <span class="mode__time">{Math.round(result.minutes)} min</span>
          <span class="mode__dist">{result.miles.toFixed(1)} mi</span>
        </>
      ) : (
        <span class="mode__na">Not available</span>
      )}
    </div>
  );
}

export function ScorecardScreen({ listing, result, prefs, commute, save, onSave, onEdit, onRetryCommute, onEditAddress, onAnother, onPreferences }: {
  listing: Listing; result: FitScoreResult; prefs: Preferences; commute: CommuteState; save: SaveState;
  onSave: () => void; onEdit: () => void; onRetryCommute: () => void; onEditAddress: () => void; onAnother: () => void; onPreferences: () => void;
}) {
  const band = scoreBand(result.score);
  const c = commute.status === "done" ? commute.value : null;
  const recurring = result.breakdown.items.filter((i) => i.recurring);
  const oneTime = result.breakdown.items.filter((i) => !i.recurring);
  const total = result.estimatedMonthlyTotal;
  const budgetDiff = total !== null && prefs.budget ? prefs.budget - total : null;
  const questions = landlordQuestions(listing.facts, result.breakdown);
  const preferredMode = prefs.transportMode;
  const preferredMiles = c?.kind === "ok" && c.modes[preferredMode].kind === "ok" ? (c.modes[preferredMode] as { miles: number }).miles : null;

  return (
    <div class="stack">
      <Header context="Your listing match" title={band.title} lede={`${listing.title} · ${SOURCE_LABEL[listing.source]}`} />

      <Card tone="brand">
        <div class="scorecard__hero">
          <ScoreRing score={result.score} label="of 100" />
          <div>
            <div class="scorecard__band">{band.label}</div>
            <div class="scorecard__summary">{summary(result, prefs, c)}</div>
          </div>
        </div>
      </Card>

      <Section title="Estimated monthly total" aside="Per person" id="cost">
        <Card>
          {total !== null ? (
            <>
              <div class="total"><span class="total__amount">{money(total)}</span><span class="total__unit">/ month</span></div>
              {budgetDiff !== null ? (
                <span class={`budgetpill ${budgetDiff >= 0 ? "budgetpill--under" : "budgetpill--over"}`}>
                  {budgetDiff >= 0 ? `${money(budgetDiff)} below your ${money(prefs.budget!)} budget` : `${money(-budgetDiff)} over your ${money(prefs.budget!)} budget`}
                </span>
              ) : (
                <span class="budgetpill budgetpill--none">No budget set</span>
              )}
            </>
          ) : (
            <span class="budgetpill budgetpill--none">Rent not listed</span>
          )}
          <div class="lines">
            {recurring.map((i) => (
              <div class="line" key={i.id}>
                <span class="line__label">{i.label} <ProvenanceTag provenance={i.provenance} /></span>
                <span class={`line__value ${i.amount === null ? "line__value--muted" : ""}`}>{i.amount === null ? "Not listed" : money(i.amount)}</span>
              </div>
            ))}
            {oneTime.map((i) => (
              <div class="line" key={i.id}>
                <span class="line__label">{i.label} <span class="line__sub">one-time</span> <ProvenanceTag provenance={i.provenance} /></span>
                <span class={`line__value ${i.amount === null ? "line__value--muted" : ""}`}>{i.amount === null ? "Not listed" : money(i.amount)}</span>
              </div>
            ))}
          </div>
          <p class="fine" style="margin-top:12px">Recurring costs only in the total. Deposit and application fees are one-time and excluded.{result.breakdown.bedroomsEstimated ? " Bedrooms weren't listed, so per-person estimates assume one." : ""}</p>
        </Card>
      </Section>

      <Section title="Why this score?" aside="Based on your priorities" id="why">
        <Card>
          {(["cost", "commute", "lease", "amenities"] as Category[]).map((cat) => {
            const r = result.categories[cat];
            return (
              <CategoryBar
                key={cat}
                title={`${CATEGORY_TEXT[cat]} · ${PRIORITY_TEXT[prefs.priorities[cat]]}`}
                detail={categoryDetail(cat, result, prefs, listing, c)}
                points={r.points}
                max={r.max}
                state={r.fraction >= 0.8 ? "good" : r.fraction > 0.5 ? "mid" : "poor"}
              />
            );
          })}
        </Card>
      </Section>

      <Section title="Commute to Cal Poly" aside={preferredMiles !== null ? `${preferredMiles.toFixed(1)} mi by ${MODE_LABEL[preferredMode].toLowerCase()}` : undefined} id="commute">
        {commute.status === "loading" || commute.status === "idle" ? (
          <Card><p class="muted">Looking up the commute from this address…</p></Card>
        ) : c?.kind === "address-not-found" ? (
          <Notice tone="danger" title="Address could not be located" role="alert">
            Commute isn't scored until the address is fixed. <Button variant="link" onClick={onEditAddress}>Edit address</Button>
          </Notice>
        ) : c?.kind === "transient-failure" ? (
          <Notice tone="warn" title="Commute lookup failed" role="alert">
            {c.message} <Button variant="link" onClick={onRetryCommute}>Retry</Button>
          </Notice>
        ) : c ? (
          <Card>
            <div class="modes">
              {TRANSPORT_MODES.map((m) => <ModeTile key={m} mode={m} result={c.modes[m]} preferred={m === preferredMode} />)}
            </div>
            <p class="fine" style="margin-top:12px">To Kennedy Library. Bus time is for a weekday 8 AM departure. Estimates, not live traffic.</p>
            <p class="attrib">{c.attribution.map((a, i) => <span key={i}>{i > 0 ? " · " : ""}{a}</span>)}</p>
          </Card>
        ) : null}
      </Section>

      {(result.benefits.length > 0 || result.watchOuts.length > 0) && (
        <Section title="Benefits and watch-outs" id="insights">
          <Card>
            <ul class="insights">
              {result.benefits.map((b) => (
                <li class="insight insight--benefit" key={b.text}><span class="insight__mark">✓</span><span>{b.text}</span></li>
              ))}
              {result.watchOuts.map((w) => (
                <li class="insight insight--watch" key={w.text}><span class="insight__mark">!</span><span>{w.text}</span></li>
              ))}
            </ul>
          </Card>
        </Section>
      )}

      {questions.length > 0 && (
        <Section title="Ask the landlord" aside={`${questions.length} unknown${questions.length === 1 ? "" : "s"}`} id="questions">
          <Card>
            <ol class="questions">{questions.map((q) => <li key={q}>{q}</li>)}</ol>
          </Card>
        </Section>
      )}

      <Notice tone="info">Estimates are labelled. Confirm prices, availability, and lease terms with the landlord before deciding.</Notice>

      {save.status === "saved" && (
        <Notice tone="success" title={`Saved to ${save.listName}`} role="status">
          {save.createdDefault ? "We made a list for you. Rename it or invite roommates from the Roommates tab." : "Your roommates can see it on the Saved tab."}
        </Notice>
      )}
      {save.status === "duplicate" && <Notice tone="info" role="status">This listing is already on your list. Open it from the Saved tab.</Notice>}
      {save.status === "error" && <Notice tone="danger" title="Couldn't save" role="alert">{save.message}</Notice>}

      <div class="actions">
        <Button onClick={onSave} disabled={save.status === "saving" || save.status === "saved"}>{save.status === "saving" ? "Saving…" : save.status === "saved" ? "Saved" : "Save listing"}</Button>
        <Button variant="secondary" onClick={onEdit}>Edit details</Button>
        <div class="row row--between">
          <Button variant="link" onClick={onPreferences}>Change preferences</Button>
          <Button variant="link" onClick={onAnother}>Analyze another listing</Button>
        </div>
      </div>
    </div>
  );
}
