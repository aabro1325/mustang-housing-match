import { describe, it, expect } from "vitest";
import { memoryStore } from "@/core/storage";
import { emptyFacts, listed, type Listing } from "@/core/domain";
import { MAYA } from "@/core/fixtures";
import { fixtureCommuteProvider } from "@/providers/commute/fixture";
import { localSharingProvider } from "@/providers/sharing/local";
import type { Services } from "../services";
import { SharingController } from "./sharing";

function listing(id: string, address: string): Listing {
  const facts = emptyFacts();
  facts.address = listed(address);
  facts.rent = listed(1250);
  facts.rentBasis = "per-person";
  facts.bedrooms = listed(3);
  return { id, source: "manual", sourceUrl: null, floorPlanId: null, title: address, facts, capturedAt: "2026-10-12T00:00:00Z" };
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

async function setup() {
  const s = services();
  const c = new SharingController(s, { scoreDebounceMs: 0 });
  await c.init();
  await c.createList("Fall house", "Maya");
  c.setPreferences(MAYA);
  const listId = c.state.list!.id;
  const a = await s.sharing.addSavedListing(listId, listing("A", "870 Foothill Blvd"), null, ["Which utilities are included in the rent?"]);
  const b = await s.sharing.addSavedListing(listId, listing("B", "124 Hathway Ave"), null, []);
  await c.refresh();
  return { s, c, listId, a, b };
}

const find = (c: SharingController, id: string) => c.state.saved.find((x) => x.id === id)!;

describe("SharingController decisions", () => {
  it("sets status and reflects it in state", async () => {
    const { c, a } = await setup();
    await c.setStatus(a.id, "considering");
    expect(find(c, a.id).status).toBe("considering");
    expect(find(c, a.id).version).toBe(2);
  });

  it("sets and clears a tour", async () => {
    const { c, a } = await setup();
    await c.setTour(a.id, "2026-10-21T00:00:00.000Z");
    expect(find(c, a.id).tourAt).toBe("2026-10-21T00:00:00.000Z");
    await c.setTour(a.id, null);
    expect(find(c, a.id).tourAt).toBeNull();
  });

  it("toggles the finalist flag", async () => {
    const { c, a } = await setup();
    await c.toggleFinalist(a.id);
    expect(find(c, a.id).finalist).toBe(true);
    await c.toggleFinalist(a.id);
    expect(find(c, a.id).finalist).toBe(false);
  });

  it("adds a dated note with the author's name and ignores blank notes", async () => {
    const { c, a } = await setup();
    await c.addNote(a.id, "  ");
    expect(find(c, a.id).notes).toHaveLength(0);
    await c.addNote(a.id, "Loved the kitchen");
    const notes = find(c, a.id).notes;
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ authorName: "Maya", text: "Loved the kitchen", createdAt: "2026-10-12T10:00:00.000Z" });
  });

  it("replaces the landlord questions, trimming blanks", async () => {
    const { c, a } = await setup();
    await c.setQuestions(a.id, ["Which utilities are included in the rent?", "  Is street parking permitted? ", ""]);
    expect(find(c, a.id).landlordQuestions).toEqual(["Which utilities are included in the rent?", "Is street parking permitted?"]);
  });

  it("makes the group's first choice exclusive and leaves a success notice", async () => {
    const { c, a, b } = await setup();
    await c.selectAsGroupChoice(a.id);
    expect(find(c, a.id).status).toBe("selected");
    await c.selectAsGroupChoice(b.id);
    expect(find(c, b.id).status).toBe("selected");
    expect(find(c, a.id).status).toBe("considering");
    expect(c.state.notice).toMatchObject({ tone: "success", text: "124 Hathway Ave is the group's first choice." });
  });

  it("surfaces a provider failure as a notice without dropping state", async () => {
    const { c, a, s } = await setup();
    s.sharing.updateSavedListing = async () => { throw new Error("boom"); };
    await c.setStatus(a.id, "applied");
    expect(c.state.notice?.tone).toBe("danger");
    expect(find(c, a.id).status).toBe("saved");
  });
});
