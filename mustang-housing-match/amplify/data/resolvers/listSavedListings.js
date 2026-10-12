import { util } from "@aws-appsync/utils";
import { query } from "@aws-appsync/utils/dynamodb";
import { listKey, toSavedListing } from "./_common.js";

export function request(ctx) {
  return query({ query: { pk: { eq: listKey(ctx.args.listId) }, sk: { beginsWith: "SAVED#" } } });
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  return ctx.result.items.map(toSavedListing);
}
