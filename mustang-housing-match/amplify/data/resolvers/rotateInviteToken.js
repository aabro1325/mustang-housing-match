import { util } from "@aws-appsync/utils";
import { update, operations } from "@aws-appsync/utils/dynamodb";
import { listKey, caller } from "./_common.js";

export function request(ctx) {
  if (ctx.stash.role !== "owner") util.unauthorized();
  return update({
    key: { pk: listKey(ctx.args.listId), sk: "META" },
    update: { inviteToken: ctx.args.newToken, updatedAt: util.time.nowISO8601() },
    condition: { ownerIdentityId: { eq: caller(ctx) } },
  });
}

export function response(ctx) {
  if (ctx.error) util.unauthorized();
  const m = ctx.result;
  return {
    list: { id: ctx.args.listId, name: m.name, ownerId: m.ownerIdentityId, createdAt: m.createdAt, members: [] },
    inviteToken: ctx.args.newToken,
  };
}
