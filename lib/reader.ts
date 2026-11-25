import { AccessTokenErrorCode } from "@auth0/nextjs-auth0/errors";
import { webAuth } from "./auth0";
import { siteOrigin } from "./config";
import { handleHolds } from "./holds-api";

export async function readerHolds(method: "GET" | "POST", bookId?: string) {
  const auth = webAuth();
  if (!auth || !await auth.getSession()) return new Response(null, { status: 401 });
  let token: string;
  try {
    ({ token } = await auth.getAccessToken());
  } catch (error) {
    if (error instanceof Error && "code" in error &&
        (error.code === AccessTokenErrorCode.MISSING_SESSION ||
         error.code === AccessTokenErrorCode.MISSING_REFRESH_TOKEN ||
         error.code === AccessTokenErrorCode.FAILED_TO_REFRESH_TOKEN ||
         error.code === AccessTokenErrorCode.SESSION_EXPIRED)) {
      return new Response(null, { status: 401 });
    }
    throw error;
  }
  return handleHolds(new Request(siteOrigin() + "/api/holds", {
    method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(method === "POST" ? { body: JSON.stringify({ bookId }) } : {}),
  }));
}
