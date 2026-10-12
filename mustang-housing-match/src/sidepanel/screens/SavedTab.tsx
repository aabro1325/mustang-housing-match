import { useEffect, useMemo, useState } from "preact/hooks";
import { Button } from "../components/Button";
import { Chip } from "../components/Chip";
import { Header } from "../components/Header";
import { Notice } from "../components/Notice";
import { useStore } from "../state/store";
import type { SharingController } from "../state/sharing";
import { SOURCE_LABEL } from "../state/match";
import { SavedCard } from "./saved/SavedCard";
import { SavedDetail } from "./saved/SavedDetail";
import { savedView } from "./saved/savedView";

type Sort = "recent" | "score";

export function SavedTab({ controller, onGoMatch, onGoRoommates }: { controller: SharingController; onGoMatch: () => void; onGoRoommates: () => void }) {
  const s = useStore(controller.store);
  const [sort, setSort] = useState<Sort>("recent");
  useEffect(() => { void controller.init(); }, [controller]);

  const views = useMemo(() => s.saved.map((sl) => savedView(sl, s.prefs, s.identityId)), [s.saved, s.prefs, s.identityId]);
  const sorted = useMemo(() => {
    if (sort === "recent") return views;
    return [...views].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  }, [views, sort]);

  if (!s.loaded && s.status.kind !== "error") return <div class="empty">Loading your list…</div>;

  if (s.detailId) {
    const open = s.saved.find((x) => x.id === s.detailId);
    if (open) return <SavedDetail saved={open} prefs={s.prefs} onBack={() => controller.closeDetail()} />;
  }

  const sources = new Set(s.saved.map((x) => SOURCE_LABEL[x.listing.source]));
  const count = s.saved.length;
  const lede = count === 0
    ? "Listings you save from the Match tab land here, for you and your roommates."
    : `${count} saved listing${count === 1 ? "" : "s"} from ${sources.size} source${sources.size === 1 ? "" : "s"}. Same cost basis, per person.`;

  return (
    <div class="stack">
      <Header context="Your housing shortlist" title="All your finds, one place" lede={lede} />

      {s.status.kind === "error" && <Notice tone="danger" title="Couldn't load your list" role="alert">{s.status.message} <Button variant="link" onClick={() => void controller.refresh()}>Try again</Button></Notice>}
      {s.connection === "offline" && <Notice tone="warn" role="status">You're offline. Showing the last copy of the list.</Notice>}

      {s.list && (
        <div class="listbar">
          <div class="listbar__name">
            <span class="listbar__label">List</span>
            {s.lists.length > 1 ? (
              <select class="listbar__select" aria-label="Switch list" value={s.list.id} onChange={(e) => void controller.switchList((e.currentTarget as HTMLSelectElement).value)}>
                {s.lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            ) : (
              <strong>{s.list.name}</strong>
            )}
          </div>
          <Button variant="link" onClick={onGoRoommates}>{s.list.members.length} {s.list.members.length === 1 ? "member" : "members"}</Button>
        </div>
      )}

      {count === 0 ? (
        <div class="card empty-state">
          <p class="empty-state__title">Nothing saved yet</p>
          <p class="muted small">Open a listing, analyze it on the Match tab, and save it here.</p>
          <Button variant="secondary" onClick={onGoMatch}>Go to Match</Button>
        </div>
      ) : (
        <>
          <div class="choice__row" role="radiogroup" aria-label="Sort saved listings" style="grid-template-columns: 1fr 1fr">
            <Chip selected={sort === "recent"} onClick={() => setSort("recent")}>Recently saved</Chip>
            <Chip selected={sort === "score"} onClick={() => setSort("score")}>Match score</Chip>
          </div>
          <div class="stack stack--tight">
            {sorted.map((v) => (
              <SavedCard key={v.saved.id} view={v} onOpen={() => controller.openDetail(v.saved.id)} onRemove={() => void controller.removeSaved(v.saved.id)} />
            ))}
          </div>
          <Button variant="secondary" onClick={onGoMatch}>Analyze another listing</Button>
        </>
      )}
    </div>
  );
}
