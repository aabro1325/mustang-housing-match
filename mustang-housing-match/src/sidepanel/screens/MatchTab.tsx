import { useEffect, useMemo } from "preact/hooks";
import type { Services } from "../services";
import { MatchController } from "../state/match";
import { useStore } from "../state/store";
import { Welcome } from "./match/Welcome";
import { PreferencesScreen } from "./match/PreferencesScreen";
import { AnalyzeScreen } from "./match/AnalyzeScreen";
import { ReviewScreen } from "./match/ReviewScreen";
import { ScorecardScreen } from "./match/ScorecardScreen";

export function MatchTab({ services, controller }: { services: Services; controller?: MatchController }) {
  const ctl = useMemo(() => controller ?? new MatchController(services), [services, controller]);
  const s = useStore(ctl.store);
  useEffect(() => {
    if (!s.loaded) void ctl.init();
    return () => { if (!controller) ctl.dispose(); };
  }, [ctl]);

  if (!s.loaded) return <div class="empty">Loading…</div>;

  switch (s.screen) {
    case "welcome":
      return <Welcome onStart={() => ctl.go("preferences")} onSkip={() => void ctl.skipWelcome()} />;
    case "preferences":
      return (
        <PreferencesScreen
          initial={s.prefs}
          canGoBack={s.onboarded}
          onSave={(p) => void ctl.savePreferences(p)}
          onPreview={s.listing ? (p) => ctl.previewPreferences(p) : undefined}
          onBack={() => ctl.go(s.listing ? "scorecard" : "analyze")}
        />
      );
    case "analyze":
      return (
        <AnalyzeScreen
          state={s}
          onAnalyze={() => void ctl.analyze()}
          onAnalyzeText={() => void ctl.analyzeSelectedText()}
          onManual={() => ctl.startManual()}
          onTextInput={(t) => ctl.setTextInput(t)}
          onPreferences={() => ctl.go("preferences")}
          hasScorecard={!!s.scorecard}
          onBackToScorecard={() => ctl.go("scorecard")}
        />
      );
    case "review":
      return s.review ? (
        <ReviewScreen
          review={s.review}
          onEdit={(k, v) => ctl.editFact(k, v)}
          onAmenity={(id, v) => ctl.editAmenity(id, v)}
          onRentBasis={(b) => ctl.setRentBasis(b)}
          onPlan={(id) => ctl.pickFloorPlan(id)}
          onConfirm={() => void ctl.confirmReview()}
          onBack={() => ctl.go(s.listing ? "scorecard" : "analyze")}
        />
      ) : null;
    case "scorecard":
      return s.listing && s.scorecard ? (
        <ScorecardScreen
          listing={s.listing}
          result={s.scorecard}
          prefs={s.prefs}
          commute={s.commute}
          save={s.save}
          onSave={() => void ctl.saveListing()}
          onEdit={() => ctl.editDetails()}
          onRetryCommute={() => void ctl.lookupCommute()}
          onEditAddress={() => ctl.editDetails()}
          onAnother={() => ctl.analyzeAnother()}
          onPreferences={() => ctl.go("preferences")}
        />
      ) : null;
  }
}
