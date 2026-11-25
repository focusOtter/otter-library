import { NextResponse, type NextRequest } from "next/server";
import { webAuth } from "./lib/auth0";

export function proxy(request: NextRequest) {
  return webAuth()?.middleware(request) ?? NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|api/|agent\\.json|jwks\\.json|openapi\\.json|\\.well-known/|callback|icon\\.svg|og\\.png).*)"],
};
