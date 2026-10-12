import type { Preferences, SavedListing } from "@/core/domain";
import type { Member } from "@/core/sharing/provider";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Section } from "../../components/Section";
import { STATUS_LABEL, money } from "../saved/savedView";
import { groupFitView } from "./groupFitView";

/** The roommate decision: who scores what, the group's recommended starting point, and the first-choice action. */
export function GroupFit({ saved, members, me, prefs, onChoose, onCompare, onGoMatch }: {
  saved: SavedListing[];
  members: Member[];
  me: string | null;
  prefs: Preferences | null;
  onChoose: (savedListingId: string) => void;
  onCompare: () => void;
  onGoMatch: () => void;
}) {
  const rows = groupFitView(saved, members, me, prefs);
  const top = rows[0];
  const m = members.length;
  const lede = m === 1
    ? "Invite roommates to see everyone's fit. For now, these are your scores."
    : "Find the best shared starting point without losing anyone's must-haves.";

  return (
    <>
      <div class="subhead">
        <p class="subhead__context">Roommate decision</p>
        <h2 class="subhead__title">One shortlist. {m === 1 ? "One voice" : `${m} voices`}.</h2>
        <p class="subhead__lede">{lede}</p>
      </div>

      {!top ? (
        <div class="card empty-state">
          <p class="empty-state__title">Nothing to decide on yet</p>
          <p class="muted small">Save listings from the Match tab and every member's score shows up here.</p>
          <Button variant="secondary" onClick={onGoMatch}>Go to Match</Button>
        </div>
      ) : (
        <>
          <div class="card card--brand hero">
            <div class="hero__kicker">Recommended to explore</div>
            <h2 class="hero__title">{top.saved.listing.title}</h2>
            <div class="hero__scoreline">
              <span class="hero__score">{top.mean === null ? "—" : top.mean}<span class="hero__scoremax"> /100 group fit</span></span>
              {top.total !== null && <span class="hero__total">{money(top.total)} / person</span>}
            </div>
            <p class="hero__why">{top.why ?? "Scores arrive as each roommate opens the list."}</p>
            <span class={`statuschip statuschip--${top.saved.status} hero__status`}>{STATUS_LABEL[top.saved.status]}</span>
          </div>

          <Section title={`Everyone's fit with ${top.saved.listing.title.split(",")[0]}`} aside={`${top.scored} of ${m} scored`} id="everyone">
            <ul class="fits">
              {top.scores.map(({ member, score, isMe }) => (
                <li class="fit" key={member.id}>
                  <span class="member__avatar" aria-hidden="true">{(member.displayName[0] ?? "?").toUpperCase()}</span>
                  <span class="fit__name">{member.displayName}{isMe ? " (you)" : ""}</span>
                  {score === null ? (
                    <span class="fit__pending">Not scored yet</span>
                  ) : (
                    <span class="fit__score">{score}<span class="fit__max"> /100</span></span>
                  )}
                </li>
              ))}
            </ul>
            <p class="fine">Group fit is the rounded average of individual preference scores. It does not measure interpersonal compatibility.</p>
          </Section>

          <Section title="Your shared shortlist" aside="Ranked by group fit" id="shortlist">
            <Card>
              <ol class="shortlist">
                {rows.map((r) => (
                  <li class="shortlist__row" key={r.saved.id}>
                    <div class="shortlist__main">
                      <span class="shortlist__title">{r.saved.listing.title}</span>
                      <span class="shortlist__sub">{r.scored} of {m} scored{r.saved.status !== "saved" ? ` · ${STATUS_LABEL[r.saved.status]}` : ""}</span>
                    </div>
                    <span class="shortlist__score">{r.mean === null ? "—" : r.mean}</span>
                  </li>
                ))}
              </ol>
            </Card>
          </Section>

          <Button onClick={() => onChoose(top.saved.id)} disabled={top.saved.status === "selected"}>
            {top.saved.status === "selected" ? "Group's first choice ✓" : "Save as Group's First Choice"}
          </Button>
          <Button variant="secondary" onClick={onCompare}>Review in Compare</Button>
          <p class="fine">A first choice is a discussion starter, not a booking. It sets the listing's status to Selected for everyone.</p>
        </>
      )}
    </>
  );
}
