const [base = 'https://otter-library.vercel.app', identifier = base] = process.argv.slice(2);
const app = new URL(base);
if (app.protocol !== 'https:' || app.href !== app.origin + '/') throw Error('Supply the production HTTPS origin.');
if (!identifier.trim()) throw Error('Supply the exact Auth0 API identifier.');
const scopes = ['holds:read', 'holds:write'];
const plan = [
  { method: 'POST', path: 'clients', body: {
    name: 'Otter Library Web', app_type: 'regular_web', token_endpoint_auth_method: 'client_secret_post',
    grant_types: ['authorization_code', 'refresh_token'],
    callbacks: [app.origin + '/auth/callback', 'http://localhost:3000/auth/callback'],
    allowed_logout_urls: [app.origin, 'http://localhost:3000'],
  } },
  { method: 'POST', path: 'resource-servers', body: {
    name: 'Otter Library API', identifier, signing_alg: 'RS256',
    scopes: scopes.map(value => ({ value, description: value === 'holds:read' ? 'Read your book holds' : 'Place a book hold' })),
  } },
  { method: 'PATCH', path: 'resource-servers/<new-api-id>', body: { use_for_personal_agent_protocol: true } },
  { method: 'POST', path: 'clients/cimd/preview', body: { external_client_id: app.origin + '/agent.json' } },
  { method: 'POST', path: 'clients/cimd/register', body: { external_client_id: app.origin + '/agent.json' } },
  { method: 'POST', path: 'client-grants', body: {
    client_id: '<new-cimd-client-id>', audience: identifier, subject_type: 'user', scope: scopes,
  } },
];
console.log('Dry run only — no Auth0 request sent.');
console.log(JSON.stringify(plan, null, 2));
console.log(`Separate approval required: if issuer discovery does not list ${app.origin}, append ${app.hostname} to the tenant's existing personal_agent_protocol_company_domains list. Preserve every existing entry and resource_parameter_profile.`);
