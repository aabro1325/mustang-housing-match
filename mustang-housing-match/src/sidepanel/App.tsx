import { useState } from "preact/hooks";
import { TabBar, type TabId } from "./components/TabBar";
import { MatchTab } from "./screens/MatchTab";
import { SavedTab } from "./screens/SavedTab";
import { CompareTab } from "./screens/CompareTab";
import { RoommatesTab } from "./screens/RoommatesTab";

export function App() {
  const [tab, setTab] = useState<TabId>("match");
  return (
    <div class="app">
      <header class="app__header">
        <div class="app__logo" aria-hidden="true">M</div>
        <div>
          <div class="app__title">Mustang Housing Match</div>
          <div class="app__subtitle">Cal Poly • San Luis Obispo</div>
        </div>
      </header>
      <div class="app__notice">Estimates are labelled; confirm details with the landlord</div>
      <main class="app__main" data-tab={tab}>
        {tab === "match" && <MatchTab />}
        {tab === "saved" && <SavedTab />}
        {tab === "compare" && <CompareTab />}
        {tab === "roommates" && <RoommatesTab />}
      </main>
      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
