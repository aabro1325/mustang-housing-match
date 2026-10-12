import { util } from "@aws-appsync/utils";
import { query } from "@aws-appsync/utils/dynamodb";
import { memberKey, caller } from "./_common.js";

export function request(ctx) {
  return query({ index: "byMember", query: { gsi1pk: { eq: memberKey(caller(ctx)) } } });
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  // Each membership item carries a denormalised copy of the list header (name, ownerId, createdAt).
  return ctx.result.items.map((m) => ({
    id: m.pk.slice("LIST#".length), name: m.listName, ownerId: m.listOwnerId, createdAt: m.listCreatedAt, members: [],
  }));
}
