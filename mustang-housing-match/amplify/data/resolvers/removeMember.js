import { util } from "@aws-appsync/utils";
import { remove } from "@aws-appsync/utils/dynamodb";
import { listKey, memberKey, change } from "./_common.js";

export function request(ctx) {
  if (ctx.stash.role !== "owner") util.unauthorized();
  return remove({
    key: { pk: listKey(ctx.args.listId), sk: memberKey(ctx.args.memberId) },
    condition: { role: { ne: "owner" } },
  });
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  return change(ctx, "membership");
}
