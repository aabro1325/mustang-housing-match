import { defineBackend } from "@aws-amplify/backend";
import { aws_dynamodb as dynamodb, RemovalPolicy } from "aws-cdk-lib";
import { auth } from "./auth/resource";
import { data } from "./data/resource";

const backend = defineBackend({ auth, data });

/**
 * One table, one GSI (decision: issue #10, design: docs/research/aws-sharing-backend.md).
 *   pk = LIST#<listId>   sk = META | MEMBER#<identityId> | SAVED#<savedListingId>
 *   gsi1pk = MEMBER#<identityId>  gsi1sk = LIST#<listId>   (byMember: "my lists")
 * Created here rather than as an a.model() so Amplify generates no CRUD for it; the resolvers are the only way in.
 */
const table = new dynamodb.Table(backend.data.stack, "SharedListTable", {
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

backend.data.addDynamoDbDataSource("SharedListDataSource", table);

// Escape hatch if the DSL cannot attach a data source to the subscription resolver:
//   const api = backend.data.resources.graphqlApi; api.createResolver("onListChange", { typeName: "Subscription",
//   fieldName: "onListChange", dataSource: ds, runtime: FunctionRuntime.JS_1_0_0, code: Code.fromAsset("amplify/data/resolvers/onListChange.js") })
