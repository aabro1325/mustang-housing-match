import { util } from "@aws-appsync/utils";
import { put } from "@aws-appsync/utils/dynamodb";
import { listKey, savedKey, caller, change, toSavedListing } from "./_common.js";

export function request(ctx) {
  const id = util.autoId();
  const now = util.time.nowISO8601();
  const listing = ctx.args.listing;
  return put({
    key: { pk: listKey(ctx.args.listId), sk: savedKey(id) },
    item: {
      listing, listingIdentity: listing.id, normalizedAddress: listing.normalizedAddress || null,
      commute: ctx.args.commute || null, status: "saved", finalist: false, tourAt: null,
      landlordQuestions: ctx.args.landlordQuestions || [], notes: [], fitScores: {},
      addedBy: caller(ctx), createdAt: now, updatedAt: now, version: 1,
    },
    condition: { pk: { attributeExists: false } },
  });
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  const saved = toSavedListing(ctx.result);
  return change(ctx, "saved-listing", { savedListingId: saved.id, savedListing: saved });
}
