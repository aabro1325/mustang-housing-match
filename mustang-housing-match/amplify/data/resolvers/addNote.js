import { util } from "@aws-appsync/utils";
import { listKey, savedKey, caller, change, toSavedListing } from "./_common.js";

export function request(ctx) {
  const note = {
    id: util.autoUlid(), authorId: caller(ctx), authorName: ctx.stash.displayName || "Roommate",
    text: ctx.args.text, createdAt: util.time.nowISO8601(),
  };
  return {
    operation: "UpdateItem",
    key: util.dynamodb.toMapValues({ pk: listKey(ctx.args.listId), sk: savedKey(ctx.args.savedListingId) }),
    update: {
      expression: "SET notes = list_append(if_not_exists(notes, :empty), :n), updatedAt = :now",
      expressionValues: util.dynamodb.toMapValues({ ":n": [note], ":empty": [], ":now": note.createdAt }),
    },
    condition: { expression: "attribute_exists(pk)" },
  };
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  const saved = toSavedListing(ctx.result);
  return change(ctx, "note", { savedListingId: saved.id, savedListing: saved });
}
