import { isAlphaScope } from "@/core/release";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Field } from "../../components/Field";
import { Header } from "../../components/Header";
import { Notice } from "../../components/Notice";
import { CheckIcon } from "../../components/icons";
import { SOURCE_LABEL, UNSUPPORTED_TEXT, type MatchState } from "../../state/match";

export function AnalyzeScreen({ state, onAnalyze, onAnalyzeText, onManual, onTextInput, onPreferences, hasScorecard, onBackToScorecard }: {
  state: MatchState;
  onAnalyze: () => void;
  onAnalyzeText: () => void;
  onManual: () => void;
  onTextInput: (t: string) => void;
  onPreferences: () => void;
  hasScorecard: boolean;
  onBackToScorecard: () => void;
}) {
  const { page, capture } = state;
  const busy = capture.status === "capturing";
  const alpha = isAlphaScope();
  return (
    <div class="stack">
      <Header context="Analyze a listing" title={page.status === "supported" ? "Ready when you are" : "Find a listing to analyze"} lede={page.status === "supported" ? (alpha ? "We read the listing on this page and score how it fits your preferences." : "We read the listing on this page and show you how it fits before you save anything.") : undefined} />

      {page.status === "supported" && (
        <Card>
          <div class="row row--between">
            <span class="pagecard__source">{SOURCE_LABEL[page.detected.source]}</span>
            <span class="pagecard__status"><CheckIcon /> Listing detected</span>
          </div>
          <div class="pagecard__title">{page.title || page.url}</div>
          <div class="pagecard__url">{page.url}</div>
          <div class="actions" style="margin-top:16px">
            <Button onClick={onAnalyze} disabled={busy}>{busy ? "Reading the listing…" : "Analyze listing"}</Button>
          </div>
        </Card>
      )}

      {page.status !== "supported" && (
        <Card>
          <p>{UNSUPPORTED_TEXT}</p>
          {page.status === "unsupported" && page.textListingHint && (
            <p class="small muted" style="margin-top:8px">This looks like a Facebook post. Select the post text on the page, then analyze it.</p>
          )}
          <div class="actions" style="margin-top:16px">
            <Button onClick={onAnalyzeText}>Analyze selected text</Button>
            <Button variant="secondary" onClick={onManual}>Add listing manually</Button>
          </div>
          <div class="or" style="margin:16px 0 12px">or paste the post</div>
          <Field label="Post text" id="posttext">
            <textarea id="posttext" value={state.textInput} placeholder="Paste the listing text here" onInput={(e) => onTextInput((e.currentTarget as HTMLTextAreaElement).value)} />
          </Field>
          {state.textError && <div style="margin-top:8px"><Notice tone="warn" role="alert">{state.textError}</Notice></div>}
        </Card>
      )}

      {capture.status === "error" && <Notice tone="danger" title="Couldn't read this page" role="alert">{capture.message} You can add the listing manually instead.</Notice>}

      <div class="row row--between">
        <Button variant="link" onClick={onPreferences}>Edit preferences</Button>
        {hasScorecard && <Button variant="link" onClick={onBackToScorecard}>Back to last scorecard</Button>}
      </div>
    </div>
  );
}
