// Pipeline step 1 for every per-list operation: the caller must hold a MEMBER# record on the list.
import { util } from "@aws-appsync/utils";
import { get } from "@aws-appsync/utils/dynamodb";
import { listKey, memberKey, caller } from "./_common.js";

export function request(ctx) {
  return get({ key: { pk: listKey(ctx.args.listId), sk: memberKey(caller(ctx)) } });
}

export function response(ctx) {
  if (ctx.error || !ctx.result) util.unauthorized();
  ctx.stash.role = ctx.result.role;
  ctx.stash.displayName = ctx.result.displayName;
  return ctx.result;
}
