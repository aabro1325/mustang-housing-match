import { describe, it, expect, vi } from "vitest";
import { memoryStore } from "@/core/storage";
import { emptyFacts, listed, type Listing } from "@/core/domain";
import { appSyncSharingProvider, Q, type GraphqlClient } from "./appsync";

function listing(id: string): Listing {
  const facts = emptyFacts();
  facts.address = listed("870 Foothill Blvd");
  return { id, source: "manual", sourceUrl: null, floorPlanId: null, title: id, facts, capturedAt: "2026-10-12T00:00:00Z" };
}

const savedRow = (id: string, extra: Record<string, unknown> = {}) => ({
  id, listId: "L", listing: JSON.stringify(listing(id)), commute: null, status: "saved", finalist: false, tourAt: null,
  landlordQuestions: [], notes: "[]", fitScores: "{}", addedBy: "me", createdAt: "2026-10-12T00:00:00Z", updatedAt: "2026-10-12T00:00:00Z", version: 1, ...extra,
});

function fakeClient(handlers: Record<string, (vars: Record<string, unknown>) => unknown>) {
  const calls: { op: string; vars: Record<string, unknown> }[] = [];
  const client: GraphqlClient = {
    graphql({ query, variables }) {
      const op = Object.entries(Q).find(([, q]) => q === query)?.[0] ?? "?";
      calls.push({ op, vars: variables ?? {} });
      if (op === "onListChange") {
        return { subscribe: () => ({ unsubscribe: vi.fn() }) };
      }
      const h = handlers[op];
      if (!h) return Promise.resolve({ errors: [{ message: `no handler for ${op}` }] });
      const out = h(variables ?? {});
      return Promise.resolve(out instanceof Error ? { errors: [{ message: out.message }] } : { data: { [op]: out } });
    },
  };
  return { client, calls };
}

describe("appsync sharing provider", () => {
  it("creates a list with a client-generated token and mirrors the identity", async () => {
    const { client, calls } = fakeClient({
      createList: (v) => ({ list: { id: "L", name: v.name, ownerId: "me", createdAt: "t", members: [] }, inviteToken: v.inviteToken }),
    });
    const store = memoryStore();
    const p = appSyncSharingProvider({ client, identityId: async () => "me", store });
    expect(await p.identity()).toEqual({ id: "me" });
    expect(await store.get("mhm.sharing.identityId")).toBe("me");
    const { inviteToken } = await p.createList("Fall", "Maya");
    expect(inviteToken).toMatch(/^[0-9a-f]{64}$/);
    expect(calls[0]!.vars.inviteToken).toBe(inviteToken);
  });

  it("falls back to the mirrored identity when Cognito is unreachable", async () => {
    const { client } = fakeClient({});
    const store = memoryStore({ "mhm.sharing.identityId": "cached-me" });
    const p = appSyncSharingProvider({ client, identityId: async () => { throw new Error("network"); }, store });
    expect(await p.identity()).toEqual({ id: "cached-me" });
  });

  it("maps resolver errors to SharingError codes", async () => {
    const { client } = fakeClient({ joinList: () => new Error("Unauthorized") });
    const p = appSyncSharingProvider({ client, identityId: async () => "me", store: memoryStore() });
    await expect(p.joinList("L", "bad", "Alex")).rejects.toMatchObject({ code: "unauthorized" });
  });

  it("parses AWSJSON fields and detects duplicates before adding", async () => {
    const { client, calls } = fakeClient({
      listSavedListings: () => [savedRow("A", { notes: JSON.stringify([{ id: "n1", authorId: "me", authorName: "Maya", text: "hi", createdAt: "t" }]) })],
      addSavedListing: (v) => ({ listId: "L", kind: "saved-listing", savedListingId: "B", actorId: "me", at: "t", savedListing: savedRow("B", { listing: v.listing }) }),
    });
    const p = appSyncSharingProvider({ client, identityId: async () => "me", store: memoryStore() });
    const rows = await p.listSavedListings("L");
    expect(rows[0]!.listing.facts.address.value).toBe("870 Foothill Blvd");
    expect(rows[0]!.notes[0]!.text).toBe("hi");
    await expect(p.addSavedListing("L", listing("A"), null, [])).rejects.toMatchObject({ code: "duplicate" });
    const added = await p.addSavedListing("L", listing("B"), null, ["Q?"]);
    expect(added.id).toBe("B");
    expect(typeof calls.at(-1)!.vars.listing).toBe("string");
  });

  it("demotes other Selected listings when one is selected", async () => {
    const { client, calls } = fakeClient({
      listSavedListings: () => [savedRow("A", { status: "selected" }), savedRow("B")],
      updateSavedListing: (v) => ({ listId: "L", kind: "saved-listing", savedListingId: v.savedListingId, actorId: "me", at: "t", savedListing: savedRow(v.savedListingId as string, { status: JSON.parse(v.patch as string).status }) }),
    });
    const p = appSyncSharingProvider({ client, identityId: async () => "me", store: memoryStore() });
    const r = await p.updateSavedListing("L", "B", { status: "selected" });
    expect(r.status).toBe("selected");
    const updates = calls.filter((c) => c.op === "updateSavedListing").map((c) => [c.vars.savedListingId, JSON.parse(c.vars.patch as string).status]);
    expect(updates).toEqual([["A", "considering"], ["B", "selected"]]);
  });

  it("subscribes and forwards parsed changes", async () => {
    let next: ((v: { data?: Record<string, unknown> }) => void) | undefined;
    const client: GraphqlClient = {
      graphql: () => ({ subscribe: (o: { next: typeof next }) => { next = o.next; return { unsubscribe: vi.fn() }; } }) as never,
    };
    const p = appSyncSharingProvider({ client, identityId: async () => "me", store: memoryStore() });
    const seen: string[] = [];
    const off = p.subscribe("L", (c) => seen.push(c.kind));
    next!({ data: { onListChange: { listId: "L", kind: "note", actorId: "x", at: "t" } } });
    expect(seen).toEqual(["note"]);
    off();
  });
});
