import { isAlphaScope } from "@/core/release";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { SlidersIcon, SparkIcon, PeopleIcon } from "../../components/icons";

export function Welcome({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  const alpha = isAlphaScope();
  return (
    <div class="stack">
      <div class="welcome__hero">
        <h1>Less housing chaos. More “this is the one.”</h1>
        <p>{alpha
          ? "Find an off-campus place that fits your budget, your lease, and the amenities you want."
          : "Find an off-campus place that fits your budget, your routine, and your roommates."}</p>
      </div>
      <Card>
        <div class="feature">
          <span class="feature__icon"><SlidersIcon /></span>
          <div>
            <div class="feature__title">Tell us what matters</div>
            <div class="feature__body">{alpha
              ? "Set your budget, lease, room, and must-haves. Amounts are per person."
              : "Set your budget, commute, and must-haves. Amounts are per person."}</div>
          </div>
        </div>
        <div class="feature">
          <span class="feature__icon"><SparkIcon /></span>
          <div>
            <div class="feature__title">{alpha ? "Score every listing" : "Make every listing clearer"}</div>
            <div class="feature__body">{alpha
              ? "See a 0 to 100 fit score, and why it landed there."
              : "See estimated costs, the commute to campus, and a 0 to 100 fit score."}</div>
          </div>
        </div>
        <div class="feature">
          <span class="feature__icon"><PeopleIcon /></span>
          <div>
            <div class="feature__title">{alpha ? "Check what we captured" : "Choose together"}</div>
            <div class="feature__body">{alpha
              ? "We read the listing, label anything not listed, and you can correct it before the score."
              : "Save finds to a shared list and compare a shortlist with your roommates."}</div>
          </div>
        </div>
      </Card>
      <p class="small muted">Works on Zillow, Craigslist, and Apartments.com pages. Facebook posts can be pasted in.</p>
      <div class="actions" style="margin-top:0">
        <Button onClick={onStart}>Set my preferences</Button>
        <Button variant="secondary" onClick={onSkip}>Skip for now</Button>
      </div>
      <p class="fine">You can change preferences anytime. Independent student project; not affiliated with Cal Poly or any listing site.</p>
    </div>
  );
}
