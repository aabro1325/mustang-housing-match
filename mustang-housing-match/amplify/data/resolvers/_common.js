// Not a resolver: shared helpers bundled into each resolver by esbuild (see backend.ts). __TABLE_NAME__ is defined there.
import { util } from "@aws-appsync/utils";

export const listKey = (listId) => `LIST#${listId}`;
export const memberKey = (identityId) => `MEMBER#${identityId}`;
export const savedKey = (id) => `SAVED#${id}`;

export function caller(ctx) {
  const id = ctx.identity && ctx.identity.cognitoIdentityId;
  if (!id) util.unauthorized();
  return id;
}

export function change(ctx, kind, extra) {
  return { listId: ctx.args.listId, kind, actorId: caller(ctx), at: util.time.nowISO8601(), ...(extra || {}) };
}

export function toMember(item) {
  return { id: item.sk.slice("MEMBER#".length), displayName: item.displayName, role: item.role, joinedAt: item.joinedAt };
}

export function toSavedListing(item) {
  return {
    id: item.sk.slice("SAVED#".length), listId: item.pk.slice("LIST#".length), listing: item.listing, commute: item.commute || null,
    status: item.status, finalist: !!item.finalist, tourAt: item.tourAt || null, landlordQuestions: item.landlordQuestions || [],
    notes: item.notes || [], fitScores: item.fitScores || {}, addedBy: item.addedBy, createdAt: item.createdAt,
    updatedAt: item.updatedAt, version: item.version || 1,
  };
}
