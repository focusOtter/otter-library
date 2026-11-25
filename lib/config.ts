export function siteOrigin() {
  return new URL(process.env.APP_BASE_URL || "http://localhost:3000").origin;
}

export function tenantIssuer() {
  const domain = process.env.AUTH0_DOMAIN;
  return domain ? new URL(`https://${domain}`).origin + "/" : undefined;
}
