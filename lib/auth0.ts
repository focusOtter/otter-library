import { Auth0Client } from "@auth0/nextjs-auth0/server";

let auth: Auth0Client | undefined;

export function webAuth() {
  if (!process.env.AUTH0_DOMAIN || !process.env.AUTH0_CLIENT_ID ||
      !process.env.AUTH0_CLIENT_SECRET || !process.env.AUTH0_SECRET || !process.env.AUTH0_AUDIENCE) {
    return undefined;
  }
  return auth ??= new Auth0Client({
    authorizationParameters: { audience: process.env.AUTH0_AUDIENCE, scope: "openid profile holds:read holds:write" },
    enableAccessTokenEndpoint: false,
  });
}
