import { calculateJwkThumbprint } from "jose";

export async function GET() {
  try {
    const { kty, crv, x, y } = JSON.parse(process.env.AGENT_PUBLIC_JWK || "{}");
    if (kty !== "EC" || crv !== "P-256" || typeof x !== "string" || typeof y !== "string") {
      return Response.json({ error: "agent_key_not_configured" }, { status: 503 });
    }
    const jwk = { kty, crv, x, y };
    return Response.json({ keys: [{ ...jwk, kid: await calculateJwkThumbprint(jwk), alg: "ES256", use: "sig" }] });
  } catch {
    return Response.json({ error: "invalid_agent_key" }, { status: 503 });
  }
}
