import { useState } from "preact/hooks";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Section } from "../../components/Section";

/** Landlord Questions: the generated ones plus the group's own. Removing and adding both persist the whole list. */
export function QuestionsPanel({ questions, onChange }: { questions: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState("");

  function add() {
    const t = draft.trim();
    if (!t) return;
    onChange([...questions, t]);
    setDraft("");
  }

  return (
    <Section title="Ask the landlord" aside={questions.length ? `${questions.length}` : undefined} id="questions">
      <Card>
        {questions.length === 0 ? (
          <p class="small muted">Every listing fact is accounted for. Add anything else you want answered before applying.</p>
        ) : (
          <ol class="questions">
            {questions.map((q, i) => (
              <li class="question" key={`${i}-${q}`}>
                <span class="question__text">{q}</span>
                <Button variant="ghost" size="sm" aria-label={`Remove question: ${q}`} onClick={() => onChange(questions.filter((_, j) => j !== i))}>Remove</Button>
              </li>
            ))}
          </ol>
        )}
        <div class="composer composer--inline">
          <input
            class="composer__input"
            aria-label="New question"
            placeholder="Add a question"
            value={draft}
            onInput={(e) => setDraft((e.currentTarget as HTMLInputElement).value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          />
          <Button variant="secondary" size="sm" onClick={add} disabled={!draft.trim()}>Add question</Button>
        </div>
      </Card>
    </Section>
  );
}
