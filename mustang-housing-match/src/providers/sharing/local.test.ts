import { describe, it, expect } from "vitest";
import { memoryStore } from "@/core/storage";
import { emptyFacts, listed, type Listing } from "@/core/domain";
import { localSharingProvider } from "./local";

function listing(id: string): Listing {
  const facts = emptyFacts();
  facts.address = listed("870 Foothill Blvd");
  facts.rent = listed(1250);
  return { id, source: "manual", sourceUrl: null, floorPlanId: null, title: id, facts, capturedAt: "2026-10-12T00:00:00Z" };
}

function provider() {
  let n = 0;
  return localSharingProvider({ store: memoryStore(), now: () => new Date("2026-10-12T10:00:00Z"), newId: () => `id-${++n}` });
}

describe("local sharing provider", () => {
  it("creates a list with the caller as owner and returns an invite token", async () => {
    const p = provider();
    const { list, inviteToken } = await p.createList("Fall house", "Maya");
    expect(list.members).toEqual([{ id: (await p.identity()).id, displayName: "Maya", role: "owner", joinedAt: "2026-10-12T10:00:00.000Z" }]);
    expect(inviteToken).toMatch(/^[0-9a-f]{64}$/);
    expect(await p.myLists()).toHaveLength(1);
  });

  it("rejects a wrong invite token and accepts the right one", async () => {
    const p = provider();
    const { list, inviteToken } = await p.createList("Fall house", "Maya");
    await expect(p.joinList(list.id, "nope", "Alex")).rejects.toMatchObject({ code: "unauthorized" });
    await expect(p.joinList(list.id, inviteToken, "Alex")).resolves.toBeTruthy();
  });

  it("saves, patches, notes, scores, and detects duplicates", async () => {
    const p = provider();
    const { list } = await p.createList("Fall house", "Maya");
    const changes: string[] = [];
    p.subscribe(list.id, (c) => changes.push(c.kind));
    const sl = await p.addSavedListing(list.id, listing("L1"), null, ["Is parking included?"]);
    expect(sl.status).toBe("saved");
    await expect(p.addSavedListing(list.id, listing("L1"), null, [])).rejects.toMatchObject({ code: "duplicate" });
    const updated = await p.updateSavedListing(list.id, sl.id, { status: "tour-scheduled", tourAt: "2026-10-20T17:00:00Z", finalist: true });
    expect(updated.version).toBe(2);
    expect(updated.tourAt).toBe("2026-10-20T17:00:00Z");
    const note = await p.addNote(list.id, sl.id, "Loved the kitchen");
    expect(note.authorName).toBe("Maya");
    await p.setFitScore(list.id, sl.id, 84);
    const [stored] = await p.listSavedListings(list.id);
    expect(stored!.notes).toHaveLength(1);
    expect(Object.values(stored!.fitScores)[0]!.score).toBe(84);
    expect(changes).toEqual(["saved-listing", "saved-listing", "note", "fit-score"]);
  });

  it("makes Selected exclusive", async () => {
    const p = provider();
    const { list } = await p.createList("Fall house", "Maya");
    const a = await p.addSavedListing(list.id, listing("A"), null, []);
    const b = await p.addSavedListing(list.id, listing("B"), null, []);
    await p.updateSavedListing(list.id, a.id, { status: "selected" });
    await p.updateSavedListing(list.id, b.id, { status: "selected" });
    const all = await p.listSavedListings(list.id);
    expect(all.find((x) => x.id === a.id)!.status).toBe("considering");
    expect(all.find((x) => x.id === b.id)!.status).toBe("selected");
  });

  it("only the owner rotates or removes", async () => {
    const p = provider();
    const { list, inviteToken } = await p.createList("Fall house", "Maya");
    const t2 = await p.rotateInviteToken(list.id);
    expect(t2).not.toBe(inviteToken);
    await expect(p.removeMember(list.id, list.ownerId)).rejects.toMatchObject({ code: "unauthorized" });
  });
});
