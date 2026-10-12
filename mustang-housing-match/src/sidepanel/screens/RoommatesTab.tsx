import { useEffect, useMemo, useState } from "preact/hooks";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Header } from "../components/Header";
import { Notice } from "../components/Notice";
import { Section } from "../components/Section";
import { useStore } from "../state/store";
import type { SharingController } from "../state/sharing";
import { ListSetup } from "./roommates/ListSetup";
import { InviteCard } from "./roommates/InviteCard";
import { savedView } from "./saved/savedView";

export function RoommatesTab({ controller, onGoMatch }: { controller: SharingController; onGoMatch: () => void }) {
  const s = useStore(controller.store);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  useEffect(() => { void controller.init(); }, [controller]);
  const busy = s.status.kind === "loading";
  const views = useMemo(() => s.saved.map((sl) => savedView(sl, s.prefs, s.identityId)), [s.saved, s.prefs, s.identityId]);

  if (!s.loaded && s.status.kind !== "error") return <div class="empty">Loading…</div>;

  const list = s.list;
  const me = s.identityId;
  const isOwner = !!list && list.ownerId === me;

  return (
    <div class="stack">
      {list ? (
        <Header context="Your group" title={list.name} lede={`${list.members.length} ${list.members.length === 1 ? "member" : "members"}. Everyone sees the same saved listings, notes and decisions.`} />
      ) : (
        <Header context="Your group" title="One shortlist for everyone" lede="Start a shared list and send roommates the link, or join the list a roommate started." />
      )}

      {s.notice && (
        <Notice tone={s.notice.tone === "info" ? "info" : s.notice.tone} role={s.notice.tone === "danger" ? "alert" : "status"}>
          {s.notice.text} <Button variant="link" onClick={() => controller.clearNotice()}>Dismiss</Button>
        </Notice>
      )}
      {s.status.kind === "error" && <Notice tone="danger" title="Couldn't reach your list" role="alert">{s.status.message} <Button variant="link" onClick={() => void controller.refresh()}>Try again</Button></Notice>}

      {!list ? (
        <ListSetup busy={busy} onCreate={(n, w) => void controller.createList(n, w)} onJoin={(l, w) => void controller.joinFromInput(l, w)} />
      ) : (
        <>
          {isOwner && s.inviteToken && <InviteCard listId={list.id} token={s.inviteToken} onRotate={() => void controller.rotateInvite()} />}
          {isOwner && !s.inviteToken && (
            <Notice tone="info">This browser doesn't have the invitation link for this list. Rotate it to make a new one. <Button variant="link" onClick={() => void controller.rotateInvite()}>Rotate link</Button></Notice>
          )}

          <Section title="Members" id="members">
            <Card>
              <ul class="members">
                {list.members.map((m) => (
                  <li class="member" key={m.id}>
                    <span class="member__avatar" aria-hidden="true">{(m.displayName[0] ?? "?").toUpperCase()}</span>
                    <span class="member__name">{m.displayName}{m.id === me ? " (you)" : ""}</span>
                    <span class={`member__role ${m.role === "owner" ? "member__role--owner" : ""}`}>{m.role === "owner" ? "Owner" : "Member"}</span>
                    {isOwner && m.role !== "owner" && (
                      confirmRemove === m.id ? (
                        <span class="row">
                          <Button variant="ghost" size="sm" onClick={() => { setConfirmRemove(null); void controller.removeMember(m.id); }}>Remove</Button>
                          <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(null)}>Keep</Button>
                        </span>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(m.id)} aria-label={`Remove ${m.displayName}`}>Remove</Button>
                      )
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          </Section>

          <Section title="Group fit" aside={views.length ? `${views.length} saved` : undefined} id="groupfit">
            <Card>
              {views.length === 0 ? (
                <p class="muted small">Save listings from the Match tab and every member's score shows up here. <Button variant="link" onClick={onGoMatch}>Go to Match</Button></p>
              ) : (
                <ul class="groupfit">
                  {views.map((v) => {
                    const scores = list.members.map((m) => ({ m, score: m.id === me && v.score !== null ? v.score : v.saved.fitScores[m.id]?.score ?? null }));
                    const known = scores.filter((x) => x.score !== null) as { m: typeof list.members[number]; score: number }[];
                    const mean = known.length ? Math.round(known.reduce((a, b) => a + b.score, 0) / known.length) : null;
                    return (
                      <li class="groupfit__row" key={v.saved.id}>
                        <div class="groupfit__head">
                          <span class="groupfit__title">{v.saved.listing.title}</span>
                          <span class="groupfit__mean">{mean === null ? "—" : mean}<span class="muted small"> group</span></span>
                        </div>
                        <div class="groupfit__members">
                          {scores.map(({ m, score }) => (
                            <span class="groupfit__member" key={m.id}>{m.displayName.split(" ")[0]} <strong>{score === null ? "–" : score}</strong></span>
                          ))}
                        </div>
                        <div class="fine">{known.length} of {list.members.length} {list.members.length === 1 ? "roommate" : "roommates"} scored</div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </Section>

          {!isOwner && (
            confirmLeave ? (
              <Notice tone="warn">Leave {list.name}? You'll need a new invitation link to come back. <Button variant="link" onClick={() => void controller.leave()}>Leave</Button> <Button variant="link" onClick={() => setConfirmLeave(false)}>Stay</Button></Notice>
            ) : (
              <Button variant="link" onClick={() => setConfirmLeave(true)}>Leave this list</Button>
            )
          )}

          <ListSetup key={list.id} compact busy={busy} onCreate={(n, w) => void controller.createList(n, w)} onJoin={(l, w) => void controller.joinFromInput(l, w)} />
        </>
      )}
    </div>
  );
}
