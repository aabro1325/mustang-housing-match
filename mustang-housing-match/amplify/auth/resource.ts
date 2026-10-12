import { defineAuth } from "@aws-amplify/backend";

/**
 * The side panel never signs anyone in. This resource exists for the Cognito identity pool it creates, whose
 * unauthenticated (guest) role gives every anonymous Member a stable identity id that the resolvers check against
 * the membership records. Email login is declared because defineAuth requires a login method; nothing uses it.
 */
export const auth = defineAuth({
  loginWith: { email: true },
});
