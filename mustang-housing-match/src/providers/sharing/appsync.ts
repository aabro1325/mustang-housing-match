import type { Commute, Listing, Note, SavedListing } from "@/core/domain";
import type { KeyValueStore } from "@/core/storage";
import { SharingError, type ListChange, type SavedListingPatch, type SharedList, type SharingProvider } from "@/core/sharing/provider";
import { randomToken } from "@/core/sharing/invite";

/**
 * The slice of the Amplify Data client this provider uses, so tests can pass a fake and the panel can pass
 * `generateClient()` from `aws-amplify/data`. Raw GraphQL documents keep this file independent of generated types.
 */
export interface GraphqlClient {
  graphql(input: { query: string; variables?: Record<string, unknown> }): Promise<{ data?: Record<string, unknown>; errors?: { message: string; errorType?: string }[] }> | {
    subscribe(observer: { next: (v: { data?: Record<string, unknown> }) => void; error: (e: unknown) => void }): { unsubscribe(): void };
  };
}

export interface AppSyncDeps {
  client: GraphqlClient;
  /** Cognito guest identity id (from fetchAuthSession().identityId); mirrored into storage for durability. */
  identityId: () => Promise<string>;
  store: KeyValueStore;
}

const IDENTITY_KEY = "mhm.sharing.identityId";

const MEMBER_FIELDS = "id displayName role joinedAt";
const LIST_FIELDS = `id name ownerId createdAt members { ${MEMBER_FIELDS} }`;
const SAVED_FIELDS = "id listId listing commute status finalist tourAt landlordQuestions notes fitScores addedBy createdAt updatedAt version";
const CHANGE_FIELDS = `listId kind savedListingId actorId at savedListing { ${SAVED_FIELDS} }`;

export const Q = {
  myLists: `query MyLists { myLists { ${LIST_FIELDS} } }`,
  getList: `query GetList($listId: String!) { getList(listId: $listId) { ${LIST_FIELDS} } }`,
  listSavedListings: `query ListSaved($listId: String!) { listSavedListings(listId: $listId) { ${SAVED_FIELDS} } }`,
  createList: `mutation CreateList($name: String!, $inviteToken: String!, $displayName: String!) { createList(name: $name, inviteToken: $inviteToken, displayName: $displayName) { list { ${LIST_FIELDS} } inviteToken } }`,
  joinList: `mutation JoinList($listId: String!, $inviteToken: String!, $displayName: String!) { joinList(listId: $listId, inviteToken: $inviteToken, displayName: $displayName) { ${CHANGE_FIELDS} } }`,
  rotateInviteToken: `mutation Rotate($listId: String!, $newToken: String!) { rotateInviteToken(listId: $listId, newToken: $newToken) { inviteToken } }`,
  removeMember: `mutation RemoveMember($listId: String!, $memberId: String!) { removeMember(listId: $listId, memberId: $memberId) { ${CHANGE_FIELDS} } }`,
  leaveList: `mutation LeaveList($listId: String!) { leaveList(listId: $listId) { ${CHANGE_FIELDS} } }`,
  addSavedListing: `mutation AddSaved($listId: String!, $listing: AWSJSON!, $commute: AWSJSON, $landlordQuestions: [String!]) { addSavedListing(listId: $listId, listing: $listing, commute: $commute, landlordQuestions: $landlordQuestions) { ${CHANGE_FIELDS} } }`,
  updateSavedListing: `mutation UpdateSaved($listId: String!, $savedListingId: String!, $patch: AWSJSON!) { updateSavedListing(listId: $listId, savedListingId: $savedListingId, patch: $patch) { ${CHANGE_FIELDS} } }`,
  removeSavedListing: `mutation RemoveSaved($listId: String!, $savedListingId: String!) { removeSavedListing(listId: $listId, savedListingId: $savedListingId) { ${CHANGE_FIELDS} } }`,
  addNote: `mutation AddNote($listId: String!, $savedListingId: String!, $text: String!) { addNote(listId: $listId, savedListingId: $savedListingId, text: $text) { ${CHANGE_FIELDS} } }`,
  setFitScore: `mutation SetFit($listId: String!, $savedListingId: String!, $score: Int!) { setFitScore(listId: $listId, savedListingId: $savedListingId, score: $score) { ${CHANGE_FIELDS} } }`,
  onListChange: `subscription OnListChange($listId: String!) { onListChange(listId: $listId) { ${CHANGE_FIELDS} } }`,
};

type RawSaved = Record<string, unknown> & { listing: unknown; commute?: unknown; notes?: unknown; fitScores?: unknown };

function json<T>(v: unknown): T {
  return (typeof v === "string" ? JSON.parse(v) : v) as T;
}

function toSaved(raw: RawSaved): SavedListing {
  return {
    id: raw.id as string,
    listing: json<Listing>(raw.listing),
    commute: raw.commute == null ? null : json<Commute>(raw.commute),
    status: raw.status as SavedListing["status"],
    finalist: Boolean(raw.finalist),
    tourAt: (raw.tourAt as string | null) ?? null,
    landlordQuestions: (raw.landlordQuestions as string[] | null) ?? [],
    notes: raw.notes == null ? [] : json<Note[]>(raw.notes),
    fitScores: raw.fitScores == null ? {} : json<SavedListing["fitScores"]>(raw.fitScores),
    addedBy: raw.addedBy as string,
    createdAt: raw.createdAt as string,
    updatedAt: raw.updatedAt as string,
    version: Number(raw.version ?? 1),
  };
}

function toChange(raw: Record<string, unknown>): ListChange & { savedListing?: SavedListing } {
  return {
    listId: raw.listId as string,
    kind: raw.kind as ListChange["kind"],
    savedListingId: (raw.savedListingId as string | undefined) ?? undefined,
    actorId: raw.actorId as string,
    at: raw.at as string,
    savedListing: raw.savedListing ? toSaved(raw.savedListing as RawSaved) : undefined,
  };
}

function mapError(e: unknown): SharingError {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "errors" in e ? String((e as { errors: { message: string }[] }).errors?.[0]?.message) : String(e);
  if (/unauthori[sz]ed/i.test(msg)) return new SharingError("unauthorized", msg);
  if (/not ?found|no such/i.test(msg)) return new SharingError("not-found", msg);
  if (/ConditionalCheckFailed|already/i.test(msg)) return new SharingError("duplicate", msg);
  if (/network|fetch|offline/i.test(msg)) return new SharingError("offline", msg);
  return new SharingError("unknown", msg);
}

export function appSyncSharingProvider(deps: AppSyncDeps): SharingProvider {
  async function run<T>(query: string, variables: Record<string, unknown>, pick: string): Promise<T> {
    let res: { data?: Record<string, unknown>; errors?: { message: string }[] };
    try {
      res = await (deps.client.graphql({ query, variables }) as Promise<typeof res>);
    } catch (e) {
      throw mapError(e);
    }
    if (res.errors?.length) throw mapError({ errors: res.errors });
    return res.data?.[pick] as T;
  }
  async function identity(): Promise<{ id: string }> {
    const cached = await deps.store.get<string>(IDENTITY_KEY);
    try {
      const id = await deps.identityId();
      if (id !== cached) await deps.store.set(IDENTITY_KEY, id);
      return { id };
    } catch (e) {
      if (cached) return { id: cached };
      throw mapError(e);
    }
  }

  return {
    id: "appsync",
    identity,
    myLists: () => run<SharedList[]>(Q.myLists, {}, "myLists"),
    async createList(name, displayName) {
      const inviteToken = randomToken();
      const r = await run<{ list: SharedList; inviteToken: string }>(Q.createList, { name, inviteToken, displayName }, "createList");
      return { list: r.list, inviteToken: r.inviteToken };
    },
    async joinList(listId, inviteToken, displayName) {
      await run(Q.joinList, { listId, inviteToken, displayName }, "joinList");
      return run<SharedList>(Q.getList, { listId }, "getList");
    },
    getList: (listId) => run<SharedList>(Q.getList, { listId }, "getList"),
    async rotateInviteToken(listId) {
      const r = await run<{ inviteToken: string }>(Q.rotateInviteToken, { listId, newToken: randomToken() }, "rotateInviteToken");
      return r.inviteToken;
    },
    async removeMember(listId, memberId) {
      await run(Q.removeMember, { listId, memberId }, "removeMember");
    },
    async leaveList(listId) {
      await run(Q.leaveList, { listId }, "leaveList");
    },
    async listSavedListings(listId) {
      const rows = await run<RawSaved[]>(Q.listSavedListings, { listId }, "listSavedListings");
      return rows.map(toSaved).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async addSavedListing(listId, listing, commute, landlordQuestions) {
      const existing = await this.listSavedListings(listId);
      if (existing.some((s) => s.listing.id === listing.id)) throw new SharingError("duplicate", "Already on the list");
      const c = await run<Record<string, unknown>>(
        Q.addSavedListing,
        { listId, listing: JSON.stringify(listing), commute: commute ? JSON.stringify(commute) : null, landlordQuestions },
        "addSavedListing",
      );
      return toChange(c).savedListing!;
    },
    async updateSavedListing(listId, savedListingId, patch: SavedListingPatch) {
      const wire: Record<string, unknown> = { ...patch };
      if (patch.facts) {
        const current = (await this.listSavedListings(listId)).find((s) => s.id === savedListingId);
        if (!current) throw new SharingError("not-found");
        wire.listing = { ...current.listing, facts: patch.facts };
        delete wire.facts;
      }
      if (patch.status === "selected") {
        // Selected is exclusive: demote any other Selected listing first (last-write-wins, pilot-acceptable).
        for (const other of await this.listSavedListings(listId)) {
          if (other.id !== savedListingId && other.status === "selected") {
            await run(Q.updateSavedListing, { listId, savedListingId: other.id, patch: JSON.stringify({ status: "considering" }) }, "updateSavedListing");
          }
        }
      }
      const c = await run<Record<string, unknown>>(Q.updateSavedListing, { listId, savedListingId, patch: JSON.stringify(wire) }, "updateSavedListing");
      return toChange(c).savedListing!;
    },
    async removeSavedListing(listId, savedListingId) {
      await run(Q.removeSavedListing, { listId, savedListingId }, "removeSavedListing");
    },
    async addNote(listId, savedListingId, text) {
      const c = await run<Record<string, unknown>>(Q.addNote, { listId, savedListingId, text }, "addNote");
      const saved = toChange(c).savedListing!;
      return saved.notes[saved.notes.length - 1]!;
    },
    async setFitScore(listId, savedListingId, score) {
      await run(Q.setFitScore, { listId, savedListingId, score }, "setFitScore");
    },
    subscribe(listId, onChange) {
      const obs = deps.client.graphql({ query: Q.onListChange, variables: { listId } }) as {
        subscribe(o: { next: (v: { data?: Record<string, unknown> }) => void; error: (e: unknown) => void }): { unsubscribe(): void };
      };
      const sub = obs.subscribe({
        next: (v) => {
          const raw = v.data?.onListChange as Record<string, unknown> | undefined;
          if (raw) onChange(toChange(raw));
        },
        error: () => { /* the panel re-queries on reconnect (Hub CONNECTION_STATE_CHANGE) */ },
      });
      return () => sub.unsubscribe();
    },
  };
}
