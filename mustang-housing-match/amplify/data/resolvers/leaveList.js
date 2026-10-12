import { util } from "@aws-appsync/utils";
import { remove } from "@aws-appsync/utils/dynamodb";
import { listKey, memberKey, caller, change } from "./_common.js";

export function request(ctx) {
  if (ctx.stash.role === "owner") util.error("The owner cannot leave; delete the list instead", "Unauthorized");
  return remove({ key: { pk: listKey(ctx.args.listId), sk: memberKey(caller(ctx)) } });
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  return change(ctx, "membership");
}
