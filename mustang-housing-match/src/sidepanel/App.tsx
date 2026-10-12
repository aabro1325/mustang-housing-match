import { useEffect, useMemo, useState } from "preact/hooks";
import { TabBar, type TabId } from "./components/TabBar";
import { MatchTab } from "./screens/MatchTab";
import { SavedTab } from "./screens/SavedTab";
import { CompareTab } from "./screens/CompareTab";
import { RoommatesTab } from "./screens/RoommatesTab";
import { createServices, type Services } from "./services";
import { MatchController } from "./state/match";
import { SharingController } from "./state/sharing";

export function App({ services: injected }: { services?: Services } = {}) {
  const [tab, setTab] = useState<TabId>("match");
  const [services, setServices] = useState<Services | undefined>(injected);
  useEffect(() => {
    if (!services) void createServices().then(setServices);
  }, []);
  const controllers = useMemo(() => {
    if (!services) return undefined;
    const match = new MatchController(services);
    const sharing = new SharingController(services);
    // Preferences live in the Match store; the sharing side needs them for this Member's Fit Scores.
    match.store.subscribe((s) => { if (s.loaded) sharing.setPreferences(s.prefs); });
    return { match, sharing };
  }, [services]);
  useEffect(() => () => { controllers?.match.dispose(); controllers?.sharing.dispose(); }, [controllers]);
  return (
    <div class="app">
      <header class="app__header">
        <div class="app__logo" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></svg>
        </div>
        <div>
          <div class="app__title">Mustang Housing Match</div>
          <div class="app__subtitle">Cal Poly · San Luis Obispo</div>
        </div>
      </header>
      <div class="app__notice">Estimates are labelled. Confirm details with the landlord.</div>
      <main class="app__main" data-tab={tab}>
        {!services || !controllers ? (
          <div class="empty">Loading…</div>
        ) : (
          <>
            {tab === "match" && <MatchTab services={services} controller={controllers.match} />}
            {tab === "saved" && <SavedTab controller={controllers.sharing} onGoMatch={() => setTab("match")} onGoRoommates={() => setTab("roommates")} />}
            {tab === "compare" && <CompareTab controller={controllers.sharing} onNavigate={setTab} />}
            {tab === "roommates" && <RoommatesTab controller={controllers.sharing} onGoMatch={() => setTab("match")} onGoCompare={() => setTab("compare")} />}
          </>
        )}
      </main>
      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
