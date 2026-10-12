import { util } from "@aws-appsync/utils";
import { remove } from "@aws-appsync/utils/dynamodb";
import { listKey, savedKey, change } from "./_common.js";

export function request(ctx) {
  return remove({ key: { pk: listKey(ctx.args.listId), sk: savedKey(ctx.args.savedListingId) } });
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  return change(ctx, "saved-listing", { savedListingId: ctx.args.savedListingId });
}
