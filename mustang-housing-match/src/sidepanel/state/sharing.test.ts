import { describe, it, expect, vi } from "vitest";
import { memoryStore } from "@/core/storage";
import { emptyFacts, listed, type Listing } from "@/core/domain";
import { MAYA } from "@/core/fixtures";
import { fixtureCommuteProvider } from "@/providers/commute/fixture";
import { localSharingProvider } from "@/providers/sharing/local";
import { buildInviteLink } from "@/core/sharing/invite";
import type { Services } from "../services";
import { KEYS } from "../services";
import { SharingController } from "./sharing";

function listing(id: string, rent = 1250): Listing {
  const facts = emptyFacts();
  facts.address = listed("870 Foothill Blvd");
  facts.rent = listed(rent);
  facts.rentBasis = "per-person";
  facts.bedrooms = listed(3);
  return { id, source: "manual", sourceUrl: null, floorPlanId: null, title: id, facts, capturedAt: "2026-10-12T00:00:00Z" };
}

function services(): Services {
  const local = memoryStore();
  let n = 0;
  return {
    sync: memoryStore(),
    local,
    commute: fixtureCommuteProvider(),
    sharing: localSharingProvider({ store: local, now: () => new Date("2026-10-12T10:00:00Z"), newId: () => `id-${++n}` }),
    tabs: { listingTab: async () => undefined, onChange: () => () => {} },
    capture: async () => { throw new Error("unused"); },
    selectedText: async () => "",
    now: () => new Date("2026-10-12T10:00:00Z"),
  };
}

const flush = () => new Promise((r) => setTimeout(r, 5));

describe("SharingController", () => {
  it("loads with no list and reports ready", async () => {
    const c = new SharingController(services(), { scoreDebounceMs: 0 });
    await c.init();
    expect(c.state.loaded).toBe(true);
    expect(c.state.identityId).toMatch(/^local-/);
    expect(c.state.list).toBeNull();
    expect(c.state.status).toEqual({ kind: "ready" });
  });

  it("creates a list, remembers the invite token, and makes it current", async () => {
    const s = services();
    const c = new SharingController(s, { scoreDebounceMs: 0 });
    await c.init();
    await c.createList("Fall house", "Maya");
    expect(c.state.list?.name).toBe("Fall house");
    expect(c.state.list?.members[0]).toMatchObject({ displayName: "Maya", role: "owner" });
    expect(c.state.inviteToken).toMatch(/^[0-9a-f]{64}$/);
    expect(await s.local.get(KEYS.currentListId)).toBe(c.state.list?.id);
    expect(c.state.notice?.tone).toBe("success");
  });

  it("rejects an empty name and a garbage link with direction, and joins with a real link", async () => {
    const s = services();
    const c = new SharingController(s, { scoreDebounceMs: 0 });
    await c.init();
    await c.createList("", "Maya");
    expect(c.state.notice?.tone).toBe("danger");
    await c.joinFromInput("hello world", "Alex");
    expect(c.state.notice?.text).toMatch(/doesn't look like an invitation link/);
    await c.createList("Fall house", "Maya");
    const link = buildInviteLink("https://x.test/join/", c.state.list!.id, c.state.inviteToken!);
    await c.joinFromInput(link, "Maya again");
    expect(c.state.notice?.tone).toBe("success");
    await c.joinFromInput(`${c.state.list!.id}.wrongtoken`, "Alex");
    expect(c.state.notice?.text).toMatch(/didn't work/);
  });

  it("sees saved listings added through the provider, removes one, and syncs this member's fit score", async () => {
    const s = services();
    const c = new SharingController(s, { scoreDebounceMs: 0 });
    await c.init();
    await c.createList("Fall house", "Maya");
    c.setPreferences(MAYA);
    const listId = c.state.list!.id;
    await s.sharing.addSavedListing(listId, listing("A"), null, []);
    await flush();
    expect(c.state.saved).toHaveLength(1);
    await flush();
    const me = c.state.identityId!;
    const stored = (await s.sharing.listSavedListings(listId))[0]!;
    expect(stored.fitScores[me]?.score).toBeTypeOf("number");
    const setFit = vi.spyOn(s.sharing, "setFitScore");
    c.setPreferences({ ...MAYA, budget: 100 });
    await flush();
    expect(setFit).toHaveBeenCalledTimes(1);
    c.setPreferences({ ...MAYA, budget: 100 });
    await flush();
    expect(setFit).toHaveBeenCalledTimes(1);
    await c.removeSaved(stored.id);
    expect(c.state.saved).toHaveLength(0);
  });

  it("switches between lists and rotates the invite as owner", async () => {
    const s = services();
    const c = new SharingController(s, { scoreDebounceMs: 0 });
    await c.init();
    await c.createList("Fall house", "Maya");
    const first = c.state.list!.id;
    const firstToken = c.state.inviteToken;
    await c.createList("Backup options", "Maya");
    expect(c.state.lists).toHaveLength(2);
    expect(c.state.list?.name).toBe("Backup options");
    await c.switchList(first);
    expect(c.state.list?.id).toBe(first);
    expect(c.state.inviteToken).toBe(firstToken);
    await c.rotateInvite();
    expect(c.state.inviteToken).not.toBe(firstToken);
  });

  it("opens and closes the detail view and drops it when the listing is removed elsewhere", async () => {
    const s = services();
    const c = new SharingController(s, { scoreDebounceMs: 0 });
    await c.init();
    await c.createList("Fall house", "Maya");
    const listId = c.state.list!.id;
    const saved = await s.sharing.addSavedListing(listId, listing("A"), null, []);
    await flush();
    c.openDetail(saved.id);
    expect(c.state.detailId).toBe(saved.id);
    await s.sharing.removeSavedListing(listId, saved.id);
    await flush();
    await c.refresh();
    expect(c.state.detailId).toBeNull();
  });
});
