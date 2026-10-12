import { useState } from "preact/hooks";
import { buildInviteCode, buildInviteLink } from "@/core/sharing/invite";
import { Button } from "../../components/Button";
import { DEFAULT_INVITE_BASE } from "../../state/sharing";

/** The Owner's invitation link: always visible as a code field (so it can be read without clipboard access), with copy and rotate. */
export function InviteCard({ listId, token, onRotate }: { listId: string; token: string; onRotate: () => void }) {
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const base = (import.meta.env as Record<string, string | undefined>).VITE_INVITE_LINK_BASE || DEFAULT_INVITE_BASE;
  const link = buildInviteLink(base, listId, token);
  const code = buildInviteCode(listId, token);

  async function copy(text: string, what: "link" | "code") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 2500);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div class="card card--brand invite">
      <div class="invite__title">Invite your roommates</div>
      <p class="invite__body">Anyone with this link joins the list. Share it only with your group.</p>
      <label class="invite__label" for="invite-code">Invitation code</label>
      <input id="invite-code" class="invite__code" readOnly value={code} onFocus={(e) => (e.currentTarget as HTMLInputElement).select()} />
      <div class="invite__actions">
        <Button variant="secondary" onClick={() => void copy(link, "link")}>{copied === "link" ? "Copied" : "Copy invitation link"}</Button>
        <Button variant="ghost" size="sm" onClick={() => void copy(code, "code")} class="invite__ghost">{copied === "code" ? "Copied" : "Copy code only"}</Button>
      </div>
      {confirmRotate ? (
        <div class="invite__rotate">
          <span>Old links will stop working. Current members stay.</span>
          <Button variant="ghost" size="sm" class="invite__ghost" onClick={() => { setConfirmRotate(false); onRotate(); }}>Rotate link</Button>
          <Button variant="ghost" size="sm" class="invite__ghost" onClick={() => setConfirmRotate(false)}>Keep</Button>
        </div>
      ) : (
        <Button variant="ghost" size="sm" class="invite__ghost" onClick={() => setConfirmRotate(true)}>Rotate link</Button>
      )}
    </div>
  );
}
