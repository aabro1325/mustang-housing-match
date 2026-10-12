// Last-write-wins per field: only the keys present in `patch` are written; version is bumped server-side.
import { util } from "@aws-appsync/utils";
import { listKey, savedKey, change, toSavedListing } from "./_common.js";

const ALLOWED = ["status", "finalist", "tourAt", "landlordQuestions", "commute", "listing"];

export function request(ctx) {
  const patch = ctx.args.patch || {};
  const sets = ["updatedAt = :now", "#v = if_not_exists(#v, :zero) + :one"];
  const names = { "#v": "version" };
  const values = { ":now": util.time.nowISO8601(), ":zero": 0, ":one": 1 };
  for (const k of ALLOWED) {
    if (patch[k] !== undefined) {
      names[`#${k}`] = k;
      values[`:${k}`] = patch[k];
      sets.push(`#${k} = :${k}`);
    }
  }
  return {
    operation: "UpdateItem",
    key: util.dynamodb.toMapValues({ pk: listKey(ctx.args.listId), sk: savedKey(ctx.args.savedListingId) }),
    update: { expression: `SET ${sets.join(", ")}`, expressionNames: names, expressionValues: util.dynamodb.toMapValues(values) },
    condition: { expression: "attribute_exists(pk)" },
  };
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  const saved = toSavedListing(ctx.result);
  return change(ctx, "saved-listing", { savedListingId: saved.id, savedListing: saved });
}
