import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { fetchAuthSession } from "aws-amplify/auth";
import type { KeyValueStore } from "@/core/storage";
import type { SharingProvider } from "@/core/sharing/provider";
import { appSyncSharingProvider, type GraphqlClient } from "@/providers/sharing/appsync";

/** Configures Amplify for the identity pool + AppSync endpoint from .env and returns the live provider. Side panel only. */
export async function createAppSyncSharing(env: Record<string, string | undefined>, store: KeyValueStore): Promise<SharingProvider> {
  Amplify.configure({
    Auth: {
      Cognito: {
        identityPoolId: env.VITE_COGNITO_IDENTITY_POOL_ID ?? "",
        allowGuestAccess: true,
      },
    },
    API: {
      GraphQL: {
        endpoint: env.VITE_APPSYNC_GRAPHQL_ENDPOINT ?? "",
        region: env.VITE_AWS_REGION ?? "us-west-2",
        defaultAuthMode: "identityPool",
      },
    },
  });
  const client = generateClient() as unknown as GraphqlClient;
  return appSyncSharingProvider({
    client,
    store,
    identityId: async () => {
      const session = await fetchAuthSession();
      if (!session.identityId) throw new Error("No guest identity");
      return session.identityId;
    },
  });
}
