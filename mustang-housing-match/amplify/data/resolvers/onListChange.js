// Subscribe-time membership check plus a server-side filter so a connection only receives its list's events.
import { util, extensions } from "@aws-appsync/utils";
import { get } from "@aws-appsync/utils/dynamodb";
import { listKey, memberKey, caller } from "./_common.js";

export function request(ctx) {
  return get({ key: { pk: listKey(ctx.args.listId), sk: memberKey(caller(ctx)) } });
}

export function response(ctx) {
  if (ctx.error || !ctx.result) util.unauthorized();
  extensions.setSubscriptionFilter(util.transform.toSubscriptionFilter({ listId: { eq: ctx.args.listId } }));
  return null;
}
