# Set up Otter Library

Use a dedicated demo Auth0 app and API. This sample uses one Next.js deployment for the website, holds API, agent metadata, and callback. In the examples, replace the HTTPS origin if your Vercel alias is different.

## 1. Preview the Auth0 changes

```sh
export SITE=https://otter-library.vercel.app
export TENANT=poppy-liendo.us.auth0.com
export AUDIENCE="$SITE"
npm run tenant:plan -- "$SITE" "$AUDIENCE"
```

This is a no-write plan. Review it before creating **Otter Library Web** (Regular Web, authorization code and refresh grants) and **Otter Library API** (RS256, `holds:read`, `holds:write`). Set the web callback to `$SITE/auth/callback`, and approve `$SITE` as a logout URL. When developing locally, add `http://localhost:3000/auth/callback` and its corresponding logout URL. Don't turn on browser join for this sample.

Enable **only** the Poppy flag on the new API. Use its Management API ID here, not the audience:

```sh
auth0 api patch "resource-servers/$API_ID" --tenant "$TENANT" \
  --data '{"use_for_personal_agent_protocol":true}' | jq '{identifier,use_for_personal_agent_protocol}'
```

Do not add `agent_subject_claims`, an anonymous user policy, or an anonymous client grant. If you can't access the Poppy or CIMD fields, confirm the tenant's entitlement first.

## 2. Generate the key and deploy once

```sh
export AGENT_ORIGIN="$SITE"
export AGENT_KEY_FILE="$HOME/.otter-library-agent.jwk"
node agent/cli.mjs keygen
```

The command creates the private JWK locally with mode 0600 and **prints only the public JWK**. Set `AGENT_PUBLIC_JWK` to that public JSON in Vercel. Don't upload the private file. In a fresh Neon database, apply [`scripts/schema.sql`](../scripts/schema.sql) and set `DATABASE_URL` to the resulting connection URI in Vercel. Set the other values from [`.env.example`](../.env.example): `APP_BASE_URL` is the production HTTPS origin, `AUTH0_DOMAIN` is the tenant hostname, `AUTH0_CLIENT_ID` and `AUTH0_CLIENT_SECRET` are for the **web** app, `AUTH0_SECRET` is a new random session-encryption secret, and `AUTH0_AUDIENCE` is the API identifier.

Deploy the Next.js project without public deployment protection on the production alias. Check that `/api/books`, `/openapi.json`, `/agent.json`, `/jwks.json`, and `/callback` return HTTP 200. Confirm that JWKS has an ES256 public key and no private member and that the metadata references the exact HTTPS callback.

## 3. Import the CIMD client and grant holds

```sh
CIMD_BODY=$(jq -nc --arg url "$SITE/agent.json" '{external_client_id:$url}')
auth0 api post clients/cimd/preview --tenant "$TENANT" --data "$CIMD_BODY" |
  jq '{validation,app_type:.mapped_fields.app_type,callbacks:.mapped_fields.callbacks}'
```

Require a valid preview and the expected callback. `application_type: "web"` should map to `regular_web`. Auth0 won't accept `native` with `private_key_jwt`, and a confidential web application's registered callback cannot be HTTP loopback. The public callback forwards only one `state`, `iss`, and `code` or `error` to the local browser handoff; the runner still verifies them and exchanges using the HTTPS redirect URI.

With approval, import using `auth0 api post clients/cimd/register --tenant "$TENANT" --data "$CIMD_BODY"`; filter the output to the internal client ID and validation fields. Grant that internal client ID both scopes for your new API with `subject_type: "user"`:

```sh
GRANT=$(jq -nc --arg cid "$CIMD_CLIENT_ID" --arg api "$AUDIENCE" \
  '{client_id:$cid,audience:$api,subject_type:"user",scope:["holds:read","holds:write"]}')
auth0 api post client-grants --tenant "$TENANT" --data "$GRANT" | jq '{audience,scope,subject_type}'
```

The API allows only the exact public `$SITE/agent.json` identity via its SDK configuration. It does not accept a bare CIMD bearer token or fetch metadata for arbitrary agents.

## 4. Check tenant settings without changing them

Third-party CIMD login needs a domain-level database connection. Check the existing connection before changing anything. On `poppy-liendo` the Outfitters demo already promoted its connection; Library does not need to repeat that change. If you see `invalid_request: no connections enabled for the client`, work with the tenant owner rather than broadening access yourself.

The tenant's authorization-server metadata must also advertise `$SITE` for the runner to trust discovery:

```sh
curl -fsS "https://$TENANT/.well-known/oauth-authorization-server" |
  jq -e --arg site "$SITE" '.protected_resources | index($site) != null'
```

If that check fails, the tenant owner must approve appending the new hostname to `personal_agent_protocol_company_domains`. Preserve all existing domains and the existing resource-parameter profile. This is a **tenant-wide change**, separate from creating the new app and API. Don't run the full setup write on a tenant without the guest and agent-principal entitlements.

Check `/.well-known/poppy.json`, `/.well-known/oauth-protected-resource`, and `/openapi.json` on your deployed site. Use the Auth0 beta CLI's `poppy doctor` as another diagnostic, not a substitute for the live consent test. Missing Anonymous Sessions and Agents as Principals are expected on the demo tenant; investigate failures on the paths Library actually uses.
