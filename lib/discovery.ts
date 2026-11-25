import { siteOrigin, tenantIssuer } from "./config";

export const scopes = {
  "holds:read": "Read your book holds",
  "holds:write": "Place a book hold",
};

export function poppyDiscovery(origin = siteOrigin(), issuer = tenantIssuer()) {
  return {
    protocol_version: "1.0",
    organization: { name: "Otter Library", domain: new URL(origin).host },
    auth: { ...(issuer ? { issuer } : {}), scopes: Object.keys(scopes), ...(issuer ? {} : { disabled: true }) },
    apis: [{ type: "openapi", url: origin + "/openapi.json", description: "Library catalog and signed-in holds" }],
  };
}

export function protectedResource(origin = siteOrigin(), issuer = tenantIssuer()) {
  return { resource: origin, authorization_servers: issuer ? [issuer] : [], scopes_supported: Object.keys(scopes) };
}

export function openapi(origin = siteOrigin()) {
  return {
    openapi: "3.1.0",
    info: { title: "Otter Library API", version: "1.0.0" },
    servers: [{ url: origin }],
    paths: {
      "/api/books": { get: { operationId: "listBooks", responses: { "200": { description: "The public shelf" } } } },
      "/api/holds": {
        get: { operationId: "listHolds", responses: { "200": { description: "Your holds" }, "401": { description: "Sign in for holds:read" }, "403": { description: "Missing holds:read" } } },
        post: {
          operationId: "placeHold",
          requestBody: { required: true, content: { "application/json": { schema: {
            type: "object", required: ["bookId"], properties: { bookId: { type: "string" } },
          } } } },
          responses: { "200": { description: "The reserved title" }, "400": { description: "Unknown book" }, "401": { description: "Sign in for holds:write" }, "403": { description: "Missing holds:write" } },
        },
      },
    },
  };
}

export function agentMetadata(origin = siteOrigin()) {
  return {
    client_id: origin + "/agent.json",
    client_name: "Otter Library Agent",
    application_type: "web",
    jwks_uri: origin + "/jwks.json",
    redirect_uris: [origin + "/callback"],
    token_endpoint_auth_method: "private_key_jwt",
    token_endpoint_auth_signing_alg: "ES256",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
  };
}
