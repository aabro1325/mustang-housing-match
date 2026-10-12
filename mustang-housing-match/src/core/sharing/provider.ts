import type { Commute, Listing, ListingFacts, Note, SavedListing } from "../domain";

export interface Member {
  id: string;
  displayName: string;
  role: "owner" | "member";
  joinedAt: string;
}

export interface SharedList {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  members: Member[];
}

export type ListChangeKind = "list" | "membership" | "saved-listing" | "note" | "fit-score";

export interface ListChange {
  listId: string;
  kind: ListChangeKind;
  savedListingId?: string;
  actorId: string;
  at: string;
}

export type SavedListingPatch = Partial<Pick<SavedListing, "status" | "finalist" | "tourAt" | "landlordQuestions" | "commute">> & {
  facts?: ListingFacts;
};

export class SharingError extends Error {
  constructor(public code: "unauthorized" | "not-found" | "duplicate" | "offline" | "unknown", message?: string) {
    super(message ?? code);
    this.name = "SharingError";
  }
}

/**
 * Everything the side panel does with Shared Lists. `local` keeps a single Member's lists in chrome.storage;
 * `appsync` talks to the AWS backend. The panel never knows which one it has.
 */
export interface SharingProvider {
  readonly id: "local" | "appsync";
  identity(): Promise<{ id: string }>;
  myLists(): Promise<SharedList[]>;
  createList(name: string, displayName: string): Promise<{ list: SharedList; inviteToken: string }>;
  joinList(listId: string, inviteToken: string, displayName: string): Promise<SharedList>;
  getList(listId: string): Promise<SharedList>;
  rotateInviteToken(listId: string): Promise<string>;
  removeMember(listId: string, memberId: string): Promise<void>;
  leaveList(listId: string): Promise<void>;
  listSavedListings(listId: string): Promise<SavedListing[]>;
  addSavedListing(listId: string, listing: Listing, commute: Commute | null, landlordQuestions: string[]): Promise<SavedListing>;
  updateSavedListing(listId: string, savedListingId: string, patch: SavedListingPatch): Promise<SavedListing>;
  removeSavedListing(listId: string, savedListingId: string): Promise<void>;
  addNote(listId: string, savedListingId: string, text: string): Promise<Note>;
  setFitScore(listId: string, savedListingId: string, score: number): Promise<void>;
  /** Realtime changes on one list. Returns an unsubscribe function. */
  subscribe(listId: string, onChange: (change: ListChange) => void): () => void;
}
