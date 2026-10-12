import { useEffect, useMemo } from "preact/hooks";
import { Button } from "../components/Button";
import { Header } from "../components/Header";
import { Notice } from "../components/Notice";
import { useStore } from "../state/store";
import type { SharingController } from "../state/sharing";
import type { TabId } from "../components/TabBar";
import { compareView } from "./compare/compareView";
import { CompareTable } from "./compare/CompareTable";

/** Finalists side by side, scored against this Member's Preferences. */
export function CompareTab({ controller, onNavigate }: { controller: SharingController; onNavigate: (tab: TabId) => void }) {
  const s = useStore(controller.store);
  useEffect(() => { void controller.init(); }, [controller]);
  const finalists = useMemo(() => s.saved.filter((x) => x.finalist), [s.saved]);
  const view = useMemo(() => (s.prefs && finalists.length ? compareView(finalists, s.prefs) : null), [finalists, s.prefs]);

  if (!s.loaded && s.status.kind !== "error") return <div class="empty">Loading your list…</div>;

  const n = finalists.length;
  if (!s.prefs) {
    return (
      <div class="stack">
        <Header context="Compare" title="See the real tradeoffs" />
        <Notice tone="info">Set your preferences on the Match tab first; the comparison is scored against them.</Notice>
        <Button variant="secondary" onClick={() => onNavigate("match")}>Go to Match</Button>
      </div>
    );
  }
  if (n < 2 || !view) {
    return (
      <div class="stack">
        <Header context="Compare" title="See the real tradeoffs" lede="Pick at least two finalists and this tab lines them up side by side, same cost basis, per person." />
        <div class="card empty-state">
          <p class="empty-state__title">{n === 0 ? "No finalists yet" : "One finalist so far"}</p>
          <p class="muted small">Open a saved listing and choose “Add to Compare”. {n === 1 ? "One more and you're comparing." : ""}</p>
          <Button variant="secondary" onClick={() => onNavigate("saved")}>Go to saved listings</Button>
        </div>
      </div>
    );
  }

  const lead = view.columns.find((c) => c.saved.id === view.leaderId);
  return (
    <div class="stack">
      <Header context={`${n}-listing comparison`} title="See the real tradeoffs" lede="Side by side, without a spreadsheet. All amounts are monthly estimates per person." />

      <div class="cmp__strip" role="list" aria-label="Finalists">
        {view.columns.map((c) => (
          <div class={`cmp__card ${c.saved.id === view.leaderId ? "cmp__card--lead" : ""}`} role="listitem" key={c.saved.id}>
            <div class="cmp__cardname">{c.shortName}{c.saved.id === view.leaderId ? "*" : ""}</div>
            <div class="cmp__cardaddr">{c.saved.listing.title}</div>
            <div class="cmp__cardsrc">{c.source}</div>
            <div class="cmp__cardscore">{c.result.score} · {c.saved.id === view.leaderId ? "Best fit*" : c.band}</div>
          </div>
        ))}
      </div>

      <CompareTable columns={view.columns} leaderId={view.leaderId} prefs={s.prefs} />

      {view.verdict && lead && (
        <Notice tone="warn" title={view.verdict.title}>{view.verdict.body}</Notice>
      )}

      <Button onClick={() => onNavigate("roommates")}>Review with roommates</Button>
      <Button variant="secondary" onClick={() => onNavigate("saved")}>Back to saved listings</Button>
      <p class="fine">* Best fit for your preferences. Your roommates' scores are on the Roommates tab.</p>
    </div>
  );
}
