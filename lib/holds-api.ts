import { ApiClient, SignInRequiredError, toHttpErrorResponse } from "@auth0/auth0-api-js";
import { findBook } from "./books";
import { siteOrigin } from "./config";
import { libraryStore, type LibraryStore } from "./store";

type Scope = "holds:read" | "holds:write";

export function createHoldsHandler(options: {
  api: ApiClient;
  site: string;
  webClientId: string;
  agentId: string;
  store: () => LibraryStore;
}) {
  return async (request: Request) => {
    const write = request.method === "POST";
    const scope: Scope = write ? "holds:write" : "holds:read";
    try {
      const { claims, poppy } = await options.api.verifyPoppyRequest({
        method: request.method,
        url: options.site + "/api/holds",
        headers: Object.fromEntries(request.headers.entries()),
      });
      if (poppy?.state === "signed_out" || !claims?.sub) {
        throw new SignInRequiredError({ scope });
      }
      const client = claims.client_id ?? claims.azp;
      if (claims.act || /^anon(_poppy)?@/.test(claims.sub) ||
          (typeof claims.sub_profile === "string" && claims.sub_profile.split(/\s+/).includes("urn:auth0:anonymous_user")) ||
          (poppy ? poppy.source !== "header" || poppy.agent.id !== options.agentId || client !== options.agentId :
            client !== options.webClientId)) {
        return Response.json({ error: "client_not_allowed" }, { status: 403 });
      }
      if (poppy && (typeof claims.scope !== "string" || !claims.scope.split(/\s+/).includes(scope))) {
        return Response.json({ error: "insufficient_scope" }, {
          status: 403, headers: { "WWW-Authenticate": `Bearer error="insufficient_scope", scope="${scope}"` },
        });
      }
      const actor = poppy ? "agent" : "person";
      const store = options.store();
      if (!write) return Response.json({ holds: await store.holds(claims.sub, actor) });
      const body: unknown = await request.json().catch(() => null);
      const book = body && typeof body === "object" && "bookId" in body ? findBook(body.bookId) : undefined;
      if (!book) return Response.json({ error: "invalid_book" }, { status: 400 });
      return Response.json({ hold: await store.place(claims.sub, book.id, actor) });
    } catch (error) {
      const failure = toHttpErrorResponse(error);
      if (!failure) return Response.json({ error: "holds_unavailable" }, { status: 500 });
      const headers = new Headers();
      for (const [name, values] of Object.entries(failure.headers)) {
        for (const value of Array.isArray(values) ? values : [values]) headers.append(name, value);
      }
      return failure.body ? Response.json(failure.body, { status: failure.status, headers }) :
        new Response(null, { status: failure.status, headers });
    }
  };
}

let handler: ReturnType<typeof createHoldsHandler> | undefined;
export function handleHolds(request: Request) {
  const { AUTH0_DOMAIN: domain, AUTH0_AUDIENCE: audience, AUTH0_CLIENT_ID: webClientId } = process.env;
  if (!domain || !audience || !webClientId) {
    return Response.json({ error: "auth_not_configured" }, { status: 503 });
  }
  const site = siteOrigin();
  const agentId = site + "/agent.json";
  handler ??= createHoldsHandler({
    api: new ApiClient({ domain, audience, poppy: {
      verifySession: true, agents: [agentId], ...(site.startsWith("https://") ? { publicOrigin: site } : {}),
    } }),
    site, webClientId, agentId, store: libraryStore,
  });
  return handler(request);
}
