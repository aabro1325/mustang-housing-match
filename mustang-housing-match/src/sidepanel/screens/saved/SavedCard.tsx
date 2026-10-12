import { useState } from "preact/hooks";
import { Button } from "../../components/Button";
import { SOURCE_LABEL } from "../../state/match";
import { STATUS_LABEL, money, type SavedView } from "./savedView";

export function SavedCard({ view, onOpen, onRemove }: { view: SavedView; onOpen: () => void; onRemove: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const { saved, score, band, total, benefit, concern, details } = view;
  const f = saved.listing.facts;
  const rentLine = f.rent.value !== null ? `${money(f.rent.value)} rent${f.rentBasis === "per-person" ? " per person" : " per unit"}` : "Rent not listed";
  return (
    <article class="savedcard" aria-label={saved.listing.title}>
      <button type="button" class="savedcard__main" onClick={onOpen}>
        <div class="savedcard__top">
          <span class="savedcard__source">{SOURCE_LABEL[saved.listing.source]}</span>
          {score !== null ? (
            <span class={`scoretag scoretag--${score >= 80 ? "strong" : score >= 60 ? "solid" : "weak"}`}>{score} · {band}</span>
          ) : (
            <span class="scoretag scoretag--none">Not scored yet</span>
          )}
        </div>
        <h2 class="savedcard__title">{saved.listing.title}</h2>
        {total !== null ? (
          <div class="savedcard__total"><span class="savedcard__amount">{money(total)}</span><span class="muted small"> est. per person / month</span></div>
        ) : (
          <div class="savedcard__total"><span class="muted">Rent not listed</span></div>
        )}
        <p class="savedcard__meta">{rentLine}</p>
        {details && <p class="savedcard__meta">{details}</p>}
        {(benefit || concern) && (
          <ul class="savedcard__insights">
            {benefit && <li class="insight insight--benefit"><span class="insight__mark">✓</span><span>{benefit}</span></li>}
            {concern && <li class="insight insight--watch"><span class="insight__mark">!</span><span>{concern}</span></li>}
          </ul>
        )}
      </button>
      <div class="savedcard__foot">
        <span class={`statuschip statuschip--${saved.status}`}>{STATUS_LABEL[saved.status]}</span>
        {confirming ? (
          <span class="row">
            <span class="small muted">Remove from the list?</span>
            <Button variant="ghost" size="sm" onClick={onRemove}>Remove</Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>Keep</Button>
          </span>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setConfirming(true)} aria-label={`Remove ${saved.listing.title}`}>Remove</Button>
        )}
      </div>
    </article>
  );
}
