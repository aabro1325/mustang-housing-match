import { util } from "@aws-appsync/utils";
import { listKey, savedKey, caller, change, toSavedListing } from "./_common.js";

export function request(ctx) {
  const now = util.time.nowISO8601();
  return {
    operation: "UpdateItem",
    key: util.dynamodb.toMapValues({ pk: listKey(ctx.args.listId), sk: savedKey(ctx.args.savedListingId) }),
    update: {
      expression: "SET fitScores.#me = :entry, updatedAt = :now",
      expressionNames: { "#me": caller(ctx) },
      expressionValues: util.dynamodb.toMapValues({ ":entry": { score: ctx.args.score, computedAt: now }, ":now": now }),
    },
    condition: { expression: "attribute_exists(pk)" },
  };
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  const saved = toSavedListing(ctx.result);
  return change(ctx, "fit-score", { savedListingId: saved.id, savedListing: saved });
}
