import { AMENITIES, type AmenityId } from "@/core/domain";
import { AMENITY_LABEL, MODE_LABEL } from "@/core/scoring";
import type { Preferences } from "@/core/domain";
import type { CompareColumn } from "./compareView";

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const capitalize = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const AMENITY_TEXT: Record<"yes" | "no" | "unknown", string> = { yes: "Listed", no: "No", unknown: "Not listed" };

function Row({ label, cells }: { label: string; cells: { text: string; tone?: "muted" | "warn" | "ok"; sub?: string }[] }) {
  return (
    <div class="cmp__row" role="row">
      <div class="cmp__rowlabel" role="rowheader">{label}</div>
      {cells.map((c, i) => (
        <div class={`cmp__cell ${c.tone ? `cmp__cell--${c.tone}` : ""}`} role="cell" key={i}>
          <span>{c.text}</span>
          {c.sub && <span class="cmp__sub">{c.sub}</span>}
        </div>
      ))}
    </div>
  );
}

function Block({ step, title, children }: { step: string; title: string; children: preact.ComponentChildren }) {
  return (
    <section class="cmp__block" aria-label={title}>
      <h2 class="cmp__blocktitle"><span class="cmp__step">{step}</span>{title}</h2>
      <div class="cmp__table" role="table" aria-label={title}>{children}</div>
    </section>
  );
}

/** The three comparison blocks. Columns scroll horizontally inside the panel when the finalists don't fit. */
export function CompareTable({ columns, leaderId, prefs }: { columns: CompareColumn[]; leaderId: string | null; prefs: Preferences }) {
  const style = `--cmp-cols: ${columns.length}`;
  const heads = (
    <div class="cmp__row cmp__row--head" role="row">
      <div class="cmp__rowlabel" role="rowheader"><span class="sr-only">Listing</span></div>
      {columns.map((c) => (
        <div class={`cmp__cell cmp__head ${c.saved.id === leaderId ? "cmp__head--lead" : ""}`} role="columnheader" key={c.saved.id}>{c.shortName}{c.saved.id === leaderId ? "*" : ""}</div>
      ))}
    </div>
  );
  return (
    <div class="cmp" style={style}>
      <Block step="01" title="Total cost, not just rent">
        {heads}
        <Row label="Estimated total / month" cells={columns.map((c) => ({ text: c.total === null ? "Not listed" : money(c.total), tone: c.total === null ? "warn" : "ok" }))} />
        {prefs.budget ? (
          <Row label={`Against your ${money(prefs.budget)} budget`} cells={columns.map((c) => ({
            text: c.vsBudget === null ? "—" : c.vsBudget >= 0 ? `${money(c.vsBudget)} below` : `${money(-c.vsBudget)} over`,
            tone: c.vsBudget === null ? "muted" : c.vsBudget >= 0 ? undefined : "warn",
          }))} />
        ) : null}
        <Row label="Advertised rent" cells={columns.map((c) => ({ text: c.rent }))} />
        <Row label="Utilities (estimated unless included)" cells={columns.map((c) => ({ text: c.utilities }))} />
        <Row label="Internet (estimated)" cells={columns.map((c) => ({ text: c.internet }))} />
        <Row label="Parking" cells={columns.map((c) => ({ text: c.parking, tone: c.parking === "Not listed" ? "warn" : undefined }))} />
      </Block>

      <Block step="02" title="Your everyday fit">
        {heads}
        <Row label={`${MODE_LABEL[prefs.transportMode]} to Cal Poly (limit ${prefs.maxCommuteMinutes} min)`} cells={columns.map((c) => ({
          text: c.minutes === null ? "Not available" : `${Math.round(c.minutes)} min${c.minutesOk ? " ✓" : ""}`,
          sub: c.minutes !== null && !c.minutesOk ? `Over ${prefs.maxCommuteMinutes} min` : undefined,
          tone: c.minutes === null || !c.minutesOk ? "warn" : undefined,
        }))} />
        <Row label={`Lease (you prefer ${prefs.leaseType === "school-year" ? "school-year" : prefs.leaseType})`} cells={columns.map((c) => ({
          text: `${c.lease}${c.leaseOk ? " ✓" : ""}`,
          tone: c.leaseOk === null ? "warn" : c.leaseOk ? undefined : "muted",
        }))} />
        <Row label="Room" cells={columns.map((c) => ({ text: c.room }))} />
        <Row label="Property beds / baths" cells={columns.map((c) => ({ text: c.bedsBaths }))} />
      </Block>

      <Block step="03" title="Amenities and unknowns">
        {heads}
        {AMENITIES.map((a: AmenityId) => (
          <Row key={a} label={capitalize(AMENITY_LABEL[a])} cells={columns.map((c) => ({ text: AMENITY_TEXT[c.amenities[a]], tone: c.amenities[a] === "unknown" ? "warn" : c.amenities[a] === "no" ? "muted" : undefined }))} />
        ))}
        <Row label="Deposit" cells={columns.map((c) => ({ text: c.deposit, tone: c.deposit === "Not listed" ? "warn" : undefined }))} />
        <Row label="Application fee" cells={columns.map((c) => ({ text: c.applicationFee, tone: c.applicationFee === "Not listed" ? "warn" : undefined }))} />
        <Row label="Watch-outs" cells={columns.map((c) => ({ text: String(c.watchOuts), tone: c.watchOuts ? "warn" : "ok" }))} />
      </Block>
      <p class="fine">Unknowns are not assumed to be included or free. Move-in fees are excluded from monthly totals.</p>
    </div>
  );
}
