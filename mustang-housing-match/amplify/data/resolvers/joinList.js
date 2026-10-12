// Join = ConditionCheck META.inviteToken == presented token + Put MEMBER#<me>, in one transaction.
// Any cancellation maps to unauthorized so callers cannot tell "wrong token" from "no such list".
import { util } from "@aws-appsync/utils";
import { listKey, memberKey, caller } from "./_common.js";

export function request(ctx) {
  const me = caller(ctx);
  const now = util.time.nowISO8601();
  ctx.stash.now = now;
  return {
    operation: "TransactWriteItems",
    transactItems: [
      {
        operation: "ConditionCheck",
        key: util.dynamodb.toMapValues({ pk: listKey(ctx.args.listId), sk: "META" }),
        condition: {
          expression: "attribute_exists(pk) AND inviteToken = :t",
          expressionValues: util.dynamodb.toMapValues({ ":t": ctx.args.inviteToken }),
        },
      },
      {
        operation: "UpdateItem",
        key: util.dynamodb.toMapValues({ pk: listKey(ctx.args.listId), sk: memberKey(me) }),
        update: {
          expression:
            "SET displayName = :n, #r = if_not_exists(#r, :role), joinedAt = if_not_exists(joinedAt, :now), gsi1pk = :g1, gsi1sk = :g2",
          expressionNames: { "#r": "role" },
          expressionValues: util.dynamodb.toMapValues({
            ":n": ctx.args.displayName, ":role": "member", ":now": now, ":g1": memberKey(me), ":g2": listKey(ctx.args.listId),
          }),
        },
      },
    ],
  };
}

export function response(ctx) {
  if (ctx.error) util.unauthorized();
  return { listId: ctx.args.listId, kind: "membership", actorId: caller(ctx), at: ctx.stash.now };
}
