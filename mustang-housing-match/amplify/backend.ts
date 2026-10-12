import { defineBackend } from "@aws-amplify/backend";
import { aws_appsync as appsync, aws_dynamodb as dynamodb, aws_iam as iam, RemovalPolicy } from "aws-cdk-lib";
import { buildSync } from "esbuild";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { auth } from "./auth/resource";

/**
 * Shared List backend (decision: issue #10). Amplify's data DSL cannot combine guest (identity pool) auth with
 * custom JavaScript resolvers, so the AppSync API is defined here with CDK: IAM auth, one DynamoDB table, and
 * APPSYNC_JS resolvers from amplify/data/resolvers/ that enforce membership. `defineAuth` supplies the Cognito
 * identity pool whose unauthenticated role is the only principal allowed to call the API.
 */
const backend = defineBackend({ auth });
const stack = backend.createStack("SharedListApi");
const here = dirname(fileURLToPath(import.meta.url));

const TABLE_NAME = "mustang-housing-match-shared-list";

// pk = LIST#<listId>  sk = META | MEMBER#<identityId> | SAVED#<savedListingId>
// gsi1pk = MEMBER#<identityId>  gsi1sk = LIST#<listId>   (byMember: "my lists")
const table = new dynamodb.Table(stack, "SharedListTable", {
  tableName: TABLE_NAME,
  partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
  sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  removalPolicy: RemovalPolicy.RETAIN,
  pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
});
table.addGlobalSecondaryIndex({
  indexName: "byMember",
  partitionKey: { name: "gsi1pk", type: dynamodb.AttributeType.STRING },
  sortKey: { name: "gsi1sk", type: dynamodb.AttributeType.STRING },
});

const api = new appsync.GraphqlApi(stack, "SharedListGraphqlApi", {
  name: "mustang-housing-match-shared-list",
  definition: appsync.Definition.fromFile(join(here, "data/schema.graphql")),
  authorizationConfig: { defaultAuthorization: { authorizationType: appsync.AuthorizationType.IAM } },
  logConfig: { fieldLogLevel: appsync.FieldLogLevel.ERROR },
});
const ds = api.addDynamoDbDataSource("SharedListDataSource", table);

// AppSync's JS runtime accepts a single file importing only @aws-appsync/utils, so each resolver is bundled.
const outDir = join(here, "../.amplify/resolvers");
mkdirSync(outDir, { recursive: true });
function code(name: string): appsync.Code {
  const outfile = join(outDir, `${name}.js`);
  buildSync({
    entryPoints: [join(here, "data/resolvers", `${name}.js`)],
    outfile,
    bundle: true,
    format: "esm",
    target: "esnext",
    platform: "neutral",
    external: ["@aws-appsync/utils", "@aws-appsync/utils/*"],
    define: { __TABLE_NAME__: JSON.stringify(TABLE_NAME) },
    sourcemap: false,
    logLevel: "silent",
  });
  return appsync.Code.fromAsset(outfile);
}
const JS = appsync.FunctionRuntime.JS_1_0_0;
const fn = (name: string) => new appsync.AppsyncFunction(stack, `Fn${name}`, { api, dataSource: ds, name, runtime: JS, code: code(name) });
const assertMember = fn("assertMember");
const passthrough = appsync.Code.fromInline(
  "export function request(ctx) { return {}; }\nexport function response(ctx) { return ctx.prev.result; }",
);

function unit(typeName: "Query" | "Mutation" | "Subscription", fieldName: string) {
  api.createResolver(`${typeName}${fieldName}`, { typeName, fieldName, dataSource: ds, runtime: JS, code: code(fieldName) });
}
function member(typeName: "Query" | "Mutation", fieldName: string) {
  api.createResolver(`${typeName}${fieldName}`, {
    typeName, fieldName, runtime: JS, code: passthrough, pipelineConfig: [assertMember, fn(fieldName)],
  });
}

unit("Query", "myLists");
member("Query", "getList");
member("Query", "listSavedListings");
unit("Mutation", "createList");
unit("Mutation", "joinList");
member("Mutation", "rotateInviteToken");
member("Mutation", "removeMember");
member("Mutation", "leaveList");
member("Mutation", "addSavedListing");
member("Mutation", "updateSavedListing");
member("Mutation", "removeSavedListing");
member("Mutation", "addNote");
member("Mutation", "setFitScore");
unit("Subscription", "onListChange"); // membership check at subscribe time + server-side listId filter

// Only the identity pool's roles may call the API. Anyone can obtain a guest identity (by design); the resolvers
// decide what that identity may see.
for (const role of [backend.auth.resources.unauthenticatedUserIamRole, backend.auth.resources.authenticatedUserIamRole]) {
  role.addToPrincipalPolicy(
    new iam.PolicyStatement({
      actions: ["appsync:GraphQL"],
      resources: [`${api.arn}/types/Query/*`, `${api.arn}/types/Mutation/*`, `${api.arn}/types/Subscription/*`],
    }),
  );
}

backend.addOutput({
  custom: {
    sharedListApi: { url: api.graphqlUrl, region: stack.region, authMode: "identityPool", tableName: TABLE_NAME },
  },
});
