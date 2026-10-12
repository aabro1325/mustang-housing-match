import { util } from "@aws-appsync/utils";
import { listKey, memberKey, caller } from "./_common.js";

export function request(ctx) {
  const me = caller(ctx);
  const listId = util.autoId();
  const now = util.time.nowISO8601();
  ctx.stash.listId = listId;
  ctx.stash.now = now;
  return {
    operation: "TransactWriteItems",
    transactItems: [
      {
        operation: "PutItem",
        key: util.dynamodb.toMapValues({ pk: listKey(listId), sk: "META" }),
        attributeValues: util.dynamodb.toMapValues({
          name: ctx.args.name, ownerIdentityId: me, inviteToken: ctx.args.inviteToken, createdAt: now, updatedAt: now,
        }),
        condition: { expression: "attribute_not_exists(pk)" },
      },
      {
        operation: "PutItem",
        key: util.dynamodb.toMapValues({ pk: listKey(listId), sk: memberKey(me) }),
        attributeValues: util.dynamodb.toMapValues({
          displayName: ctx.args.displayName, role: "owner", joinedAt: now,
          gsi1pk: memberKey(me), gsi1sk: listKey(listId), listName: ctx.args.name, listOwnerId: me, listCreatedAt: now,
        }),
      },
    ],
  };
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  const me = caller(ctx);
  return {
    list: {
      id: ctx.stash.listId, name: ctx.args.name, ownerId: me, createdAt: ctx.stash.now,
      members: [{ id: me, displayName: ctx.args.displayName, role: "owner", joinedAt: ctx.stash.now }],
    },
    inviteToken: ctx.args.inviteToken,
  };
}
