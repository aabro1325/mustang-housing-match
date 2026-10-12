import { util } from "@aws-appsync/utils";
import { query } from "@aws-appsync/utils/dynamodb";
import { listKey, toMember } from "./_common.js";

export function request(ctx) {
  return query({ query: { pk: { eq: listKey(ctx.args.listId) } } });
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  const items = ctx.result.items;
  const meta = items.find((i) => i.sk === "META");
  if (!meta) util.error("No such list", "NotFound");
  const members = items.filter((i) => i.sk.startsWith("MEMBER#")).map(toMember);
  return { id: ctx.args.listId, name: meta.name, ownerId: meta.ownerIdentityId, createdAt: meta.createdAt, members };
}
