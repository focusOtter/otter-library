import { webAuth } from "./auth0";
import { siteOrigin } from "./config";
import { handleHolds } from "./holds-api";

export async function readerHolds(method: "GET" | "POST", bookId?: string) {
  const auth = webAuth();
  if (!auth || !await auth.getSession()) return new Response(null, { status: 401 });
  const { token } = await auth.getAccessToken();
  return handleHolds(new Request(siteOrigin() + "/api/holds", {
    method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(method === "POST" ? { body: JSON.stringify({ bookId }) } : {}),
  }));
}
