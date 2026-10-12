import { useState } from "preact/hooks";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Field } from "../../components/Field";

/** Create a list or join one with a link. Shown as the empty state and, compactly, under an existing list. */
export function ListSetup({ onCreate, onJoin, busy, compact }: {
  onCreate: (name: string, displayName: string) => void; onJoin: (input: string, displayName: string) => void; busy: boolean; compact?: boolean;
}) {
  const [mode, setMode] = useState<"none" | "create" | "join">(compact ? "none" : "create");
  const [name, setName] = useState("");
  const [who, setWho] = useState("");
  const [link, setLink] = useState("");

  if (mode === "none") {
    return (
      <div class="row row--between">
        <Button variant="link" onClick={() => setMode("create")}>Start another list</Button>
        <Button variant="link" onClick={() => setMode("join")}>Join a list with a link</Button>
      </div>
    );
  }

  return (
    <Card>
      <div class="choice__row" role="radiogroup" aria-label="Create or join" style="grid-template-columns: 1fr 1fr; margin-bottom: 12px">
        <button type="button" role="radio" aria-checked={mode === "create"} class="chip" onClick={() => setMode("create")}>Create a list</button>
        <button type="button" role="radio" aria-checked={mode === "join"} class="chip" onClick={() => setMode("join")}>Join with a link</button>
      </div>
      {mode === "create" ? (
        <form onSubmit={(e) => { e.preventDefault(); onCreate(name, who); }}>
          <Field label="List name" id="list-name" hint="Something your group will recognise, like “Fall 2027 house”.">
            <input id="list-name" value={name} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} placeholder="Fall 2027 house" required />
          </Field>
          <Field label="Your name" id="create-who" hint="Shown to roommates next to your notes and scores.">
            <input id="create-who" value={who} onInput={(e) => setWho((e.currentTarget as HTMLInputElement).value)} placeholder="Maya" required />
          </Field>
          <div style="margin-top: 12px"><Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create list"}</Button></div>
        </form>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); onJoin(link, who); }}>
          <Field label="Invitation link or code" id="join-link" hint="Paste the whole link your roommate sent, or just the code.">
            <textarea id="join-link" value={link} onInput={(e) => setLink((e.currentTarget as HTMLTextAreaElement).value)} placeholder="https://…/join/#list=…&t=…" required rows={3} />
          </Field>
          <Field label="Your name" id="join-who">
            <input id="join-who" value={who} onInput={(e) => setWho((e.currentTarget as HTMLInputElement).value)} placeholder="Alex" required />
          </Field>
          <div style="margin-top: 12px"><Button type="submit" disabled={busy}>{busy ? "Joining…" : "Join list"}</Button></div>
        </form>
      )}
      {compact && <div style="margin-top: 8px"><Button variant="link" onClick={() => setMode("none")}>Cancel</Button></div>}
    </Card>
  );
}
