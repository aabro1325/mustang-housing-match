// Copies the backend values from config/amplify_outputs.json into .env (idempotent upsert).
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const outputs = JSON.parse(readFileSync("config/amplify_outputs.json", "utf8"));
const values = {
  VITE_AWS_REGION: outputs.custom?.sharedListApi?.region || outputs.auth?.aws_region || "us-west-2",
  VITE_COGNITO_IDENTITY_POOL_ID: outputs.auth?.identity_pool_id || "",
  VITE_APPSYNC_GRAPHQL_ENDPOINT: outputs.custom?.sharedListApi?.url || "",
  VITE_APPSYNC_AUTH_MODE: "identityPool",
  VITE_SHARING_PROVIDER: "appsync",
};
for (const [k, v] of Object.entries(values)) if (!v) throw new Error(`missing ${k} in amplify_outputs.json`);

let env = existsSync(".env") ? readFileSync(".env", "utf8") : "";
for (const [k, v] of Object.entries(values)) {
  const line = `${k}=${v}`;
  env = new RegExp(`^${k}=.*$`, "m").test(env) ? env.replace(new RegExp(`^${k}=.*$`, "m"), line) : env.trimEnd() + `\n${line}\n`;
}
writeFileSync(".env", env);
console.log("wrote", Object.keys(values).join(", "), "to .env");
