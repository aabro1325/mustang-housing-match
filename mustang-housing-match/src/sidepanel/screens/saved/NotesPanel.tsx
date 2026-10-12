import { useState } from "preact/hooks";
import type { Note } from "@/core/domain";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Section } from "../../components/Section";
import { formatNoteDate } from "./dates";

/** Dated notes, oldest first so a conversation reads top to bottom; the composer sits at the end. */
export function NotesPanel({ notes, onAdd }: { notes: Note[]; onAdd: (text: string) => void }) {
  const [draft, setDraft] = useState("");
  const ordered = [...notes].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  function submit() {
    const t = draft.trim();
    if (!t) return;
    onAdd(t);
    setDraft("");
  }

  return (
    <Section title="Notes" aside={ordered.length ? `${ordered.length}` : undefined} id="notes">
      <Card>
        {ordered.length === 0 ? (
          <p class="small muted">Nothing yet. Jot down what you saw on a tour or what the landlord said; your roommates see it too.</p>
        ) : (
          <ul class="notes">
            {ordered.map((n) => (
              <li class="note" key={n.id}>
                <div class="note__meta"><span class="note__author">{n.authorName}</span><span class="note__date">{formatNoteDate(n.createdAt)}</span></div>
                <p class="note__text">{n.text}</p>
              </li>
            ))}
          </ul>
        )}
        <div class="composer">
          <textarea
            class="composer__input"
            aria-label="New note"
            placeholder="Add a note for the group"
            value={draft}
            rows={2}
            onInput={(e) => setDraft((e.currentTarget as HTMLTextAreaElement).value)}
          />
          <Button variant="secondary" size="sm" onClick={submit} disabled={!draft.trim()}>Add note</Button>
        </div>
      </Card>
    </Section>
  );
}
