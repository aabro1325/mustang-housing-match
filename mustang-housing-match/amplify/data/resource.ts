import { a, defineData, type ClientSchema } from "@aws-amplify/backend";

/**
 * Shared List API (decision: issue #10). Every operation is a custom query, mutation or subscription whose AppSync
 * JavaScript resolver enforces membership against the SharedList DynamoDB table attached in backend.ts.
 * No model CRUD is exposed. Every field allows guests: the identity pool identifies the caller; the resolvers decide.
 */
const DS = "SharedListDataSource";
const guest = (allow: { guest: () => unknown }) => [allow.guest()];
const member = (entry: string) => [
  a.handler.custom({ dataSource: DS, entry: "./resolvers/assertMember.js" }),
  a.handler.custom({ dataSource: DS, entry }),
];

const schema = a.schema({
  Member: a.customType({
    id: a.string().required(),
    displayName: a.string().required(),
    role: a.string().required(),
    joinedAt: a.string().required(),
  }),
  SharedList: a.customType({
    id: a.string().required(),
    name: a.string().required(),
    ownerId: a.string().required(),
    createdAt: a.string().required(),
    members: a.ref("Member").array(),
  }),
  CreatedList: a.customType({
    list: a.ref("SharedList"),
    inviteToken: a.string().required(),
  }),
  SavedListing: a.customType({
    id: a.string().required(),
    listId: a.string().required(),
    /** The Listing (facts with provenance) as JSON; shape owned by src/core/domain.ts */
    listing: a.json().required(),
    commute: a.json(),
    status: a.string().required(),
    finalist: a.boolean().required(),
    tourAt: a.string(),
    landlordQuestions: a.string().array(),
    notes: a.json(),
    fitScores: a.json(),
    addedBy: a.string().required(),
    createdAt: a.string().required(),
    updatedAt: a.string().required(),
    version: a.integer().required(),
  }),
  ListChange: a.customType({
    listId: a.string().required(),
    kind: a.string().required(),
    savedListingId: a.string(),
    actorId: a.string().required(),
    at: a.string().required(),
    savedListing: a.ref("SavedListing"),
    list: a.ref("SharedList"),
  }),

  myLists: a
    .query()
    .returns(a.ref("SharedList").array())
    .authorization(guest)
    .handler(a.handler.custom({ dataSource: DS, entry: "./resolvers/myLists.js" })),
  getList: a
    .query()
    .arguments({ listId: a.string().required() })
    .returns(a.ref("SharedList"))
    .authorization(guest)
    .handler(member("./resolvers/getList.js")),
  listSavedListings: a
    .query()
    .arguments({ listId: a.string().required() })
    .returns(a.ref("SavedListing").array())
    .authorization(guest)
    .handler(member("./resolvers/listSavedListings.js")),

  createList: a
    .mutation()
    .arguments({ name: a.string().required(), inviteToken: a.string().required(), displayName: a.string().required() })
    .returns(a.ref("CreatedList"))
    .authorization(guest)
    .handler(a.handler.custom({ dataSource: DS, entry: "./resolvers/createList.js" })),
  joinList: a
    .mutation()
    .arguments({ listId: a.string().required(), inviteToken: a.string().required(), displayName: a.string().required() })
    .returns(a.ref("ListChange"))
    .authorization(guest)
    .handler(a.handler.custom({ dataSource: DS, entry: "./resolvers/joinList.js" })),
  rotateInviteToken: a
    .mutation()
    .arguments({ listId: a.string().required(), newToken: a.string().required() })
    .returns(a.ref("CreatedList"))
    .authorization(guest)
    .handler(member("./resolvers/rotateInviteToken.js")),
  removeMember: a
    .mutation()
    .arguments({ listId: a.string().required(), memberId: a.string().required() })
    .returns(a.ref("ListChange"))
    .authorization(guest)
    .handler(member("./resolvers/removeMember.js")),
  leaveList: a
    .mutation()
    .arguments({ listId: a.string().required() })
    .returns(a.ref("ListChange"))
    .authorization(guest)
    .handler(member("./resolvers/leaveList.js")),
  addSavedListing: a
    .mutation()
    .arguments({ listId: a.string().required(), listing: a.json().required(), commute: a.json(), landlordQuestions: a.string().array() })
    .returns(a.ref("ListChange"))
    .authorization(guest)
    .handler(member("./resolvers/addSavedListing.js")),
  updateSavedListing: a
    .mutation()
    .arguments({ listId: a.string().required(), savedListingId: a.string().required(), patch: a.json().required() })
    .returns(a.ref("ListChange"))
    .authorization(guest)
    .handler(member("./resolvers/updateSavedListing.js")),
  removeSavedListing: a
    .mutation()
    .arguments({ listId: a.string().required(), savedListingId: a.string().required() })
    .returns(a.ref("ListChange"))
    .authorization(guest)
    .handler(member("./resolvers/removeSavedListing.js")),
  addNote: a
    .mutation()
    .arguments({ listId: a.string().required(), savedListingId: a.string().required(), text: a.string().required() })
    .returns(a.ref("ListChange"))
    .authorization(guest)
    .handler(member("./resolvers/addNote.js")),
  setFitScore: a
    .mutation()
    .arguments({ listId: a.string().required(), savedListingId: a.string().required(), score: a.integer().required() })
    .returns(a.ref("ListChange"))
    .authorization(guest)
    .handler(member("./resolvers/setFitScore.js")),

  /**
   * One subscription for every change on a list. The handler checks membership at subscribe time (needs the data
   * source) and sets a server-side filter on listId. If the Amplify DSL rejects `dataSource` here, or `.for()` with
   * several refs, fall back to the CDK escape hatch in backend.ts (see the comment there).
   */
  onListChange: a
    .subscription()
    .for([
      a.ref("joinList"), a.ref("removeMember"), a.ref("leaveList"), a.ref("addSavedListing"), a.ref("updateSavedListing"),
      a.ref("removeSavedListing"), a.ref("addNote"), a.ref("setFitScore"),
    ])
    .arguments({ listId: a.string().required() })
    .authorization(guest)
    .handler(a.handler.custom({ dataSource: DS, entry: "./resolvers/onListChange.js" })),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: { defaultAuthorizationMode: "identityPool" },
});
