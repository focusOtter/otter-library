import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiClient } from '@auth0/auth0-api-js';
import { MockLanguageModelV3 } from 'ai/test';
import { exportJWK, generateKeyPair, jwtVerify, SignJWT } from 'jose';
import { agentMetadata, openapi, poppyDiscovery, protectedResource } from '../lib/discovery.ts';
import { createHoldsHandler } from '../lib/holds-api.ts';
import { memoryStore } from '../lib/store.ts';
import { books } from '../lib/books.ts';
import { createApprovalListener } from '../agent/approval.mjs';
import { createLibrary, runLibrary } from '../agent/library.mjs';
import { callbackUrl, createIdentity, createSession, digest, discover, startSignIn } from '../agent/protocol.mjs';

const site = 'https://library.example.com';
const issuer = 'https://auth.example.com/';
const audience = 'https://api.example.com/library';
const webClientId = 'fixture-web';
const reader = 'auth0|fixture-reader';

async function fixture({ advertised = true } = {}) {
  const signing = await generateKeyPair('ES256', { extractable: true });
  const identity = await createIdentity(site, await exportJWK(signing.privateKey));
  const issuerKeys = await generateKeyPair('RS256');
  const jwk = { ...await exportJWK(issuerKeys.publicKey), alg: 'RS256', kid: 'fixture-key' };
  const metadata = {
    issuer, protected_resources: advertised ? [site] : [],
    jwks_uri: issuer + 'jwks', token_endpoint: issuer + 'oauth/token', authorization_endpoint: issuer + 'authorize',
    grant_types_supported: ['authorization_code'],
  };
  const store = memoryStore();
  let pending;
  let handler;
  const issue = (azp, scope, subject = reader) => new SignJWT({ azp, scope })
    .setProtectedHeader({ alg: 'RS256', kid: jwk.kid, typ: 'at+jwt' })
    .setIssuer(issuer).setAudience(audience).setSubject(subject).setIssuedAt().setExpirationTime('5m').sign(issuerKeys.privateKey);
  async function fetcher(input, init) {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.href === identity.clientId) return Response.json(agentMetadata(site));
    if (url.href === identity.metadata.jwks_uri) return Response.json(identity.jwks);
    if (url.href === site + '/.well-known/poppy.json') return Response.json(poppyDiscovery(site, issuer));
    if (url.href === site + '/.well-known/oauth-protected-resource') return Response.json(protectedResource(site, issuer));
    if (url.href === site + '/openapi.json') return Response.json(openapi(site));
    if ([issuer + '.well-known/openid-configuration', issuer + '.well-known/oauth-authorization-server'].includes(url.href)) return Response.json(metadata);
    if (url.href === metadata.jwks_uri) return Response.json({ keys: [jwk] });
    if (url.href === metadata.token_endpoint) {
      assert.ok(pending);
      const form = init.body;
      assert.equal(form.get('redirect_uri'), site + '/callback');
      assert.equal(form.get('grant_type'), 'authorization_code');
      assert.equal(form.get('code'), 'fixture-approval');
      assert.equal(digest(form.get('code_verifier')), pending.get('code_challenge'));
      await jwtVerify(form.get('client_assertion'), signing.publicKey, {
        issuer: identity.clientId, subject: identity.clientId, audience: issuer, algorithms: ['ES256'],
      });
      const scope = pending.get('scope');
      return Response.json({ access_token: await issue(identity.clientId, scope), token_type: 'Bearer', scope });
    }
    if (url.href === site + '/api/books') return Response.json({ books });
    if (url.href === site + '/api/holds') return handler(new Request(url, init));
    throw Error('Unexpected fixture network destination.');
  }
  const api = new ApiClient({
    domain: new URL(issuer).hostname, audience, customFetch: fetcher,
    poppy: {
      verifySession: true, publicOrigin: site, agents: [identity.clientId], agentMetadata: { fetch: fetcher },
    },
  });
  handler = createHoldsHandler({ api, site, webClientId, agentId: identity.clientId, store: () => store });
  const session = await createSession(identity, issuer, 'fixture-pairwise-secret-not-for-production');
  const company = () => discover({ store: site, api: site, issuer, audience, fetcher });

  async function approve(scopes, complete = (tx, callback) => tx.complete(callback)) {
    const tx = await startSignIn(await company(), identity, scopes, { fetcher });
    pending = tx.url.searchParams;
    assert.equal(pending.get('audience'), audience);
    assert.equal(pending.get('scope'), scopes.join(' '));
    const callback = new URL(callbackUrl);
    callback.search = new URLSearchParams({ state: pending.get('state'), iss: issuer, code: 'fixture-approval' });
    return complete(tx, callback);
  }
  return { company, session, store, issue, fetcher, approve, identity };
}

test('the approval listener ignores invalid state and issuer and accepts the valid callback', { timeout: 5000 }, async () => {
  const lab = await fixture();
  const grant = await lab.approve(['holds:write'], async (tx, callback) => {
    const { server, promise } = createApprovalListener(tx);
    const outcome = promise.then(grant => ({ grant }), error => ({ error }));
    await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
    try {
      callback.port = server.address().port;
      for (const field of ['state', 'iss']) {
        const invalid = new URL(callback);
        invalid.searchParams.set(field, 'unexpected');
        assert.equal((await fetch(invalid)).status, 400);
      }
      assert.equal((await fetch(callback)).status, 200);
      const result = await outcome;
      assert.ifError(result.error);
      return result.grant;
    } finally {
      await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    }
  });
  assert.deepEqual([...grant.scopes], ['holds:write']);
});

test('mock model browses, gets a scoped challenge, resumes after signed consent, and keeps two activity lanes', async () => {
  const lab = await fixture();
  const calls = [];
  const approvals = [];
  const library = createLibrary(await lab.company(), lab.session, { fetcher: lab.fetcher, onResponse: (entry) => calls.push(entry) });
  const usage = { inputTokens: { total: 5 }, outputTokens: { total: 5 } };
  const step = (toolCallId, toolName, input) => ({
    content: [{ type: 'tool-call', toolCallId, toolName, input: JSON.stringify(input) }],
    finishReason: { unified: 'tool-calls', raw: undefined }, usage, warnings: [],
  });
  const model = new MockLanguageModelV3({ doGenerate: [
    step('browse', 'listBooks', {}), step('challenge', 'placeHold', { bookId: 'tideline' }),
    step('place', 'placeHold', { bookId: 'tideline' }),
    { content: [{ type: 'text', text: 'Done.' }], finishReason: { unified: 'stop', raw: undefined }, usage, warnings: [] },
  ] });
  await runLibrary(library, { prompt: 'Find a nature book and reserve it.', model, approve: async (scopes) => {
    approvals.push(...scopes);
    return lab.approve(scopes);
  } });
  assert.deepEqual(approvals, ['holds:write']);
  assert.deepEqual(calls.map(({ method, path, status }) => [method, path, status]), [
    ['GET', '/api/books', 200], ['POST', '/api/holds', 401], ['POST', '/api/holds', 200],
  ]);
  const human = await lab.fetcher(site + '/api/holds', { headers: { Authorization: 'Bearer ' + await lab.issue(webClientId, 'openid') } });
  assert.equal(human.status, 200);
  assert.equal((await human.json()).holds[0].placedBy, 'agent');
  const entries = await lab.store.activity(reader);
  assert.deepEqual(entries.map(({ actor, action }) => [actor, action]), [['person', 'viewed_holds'], ['agent', 'placed_hold']]);
  assert.deepEqual(await lab.store.activity('auth0|other-reader'), []);
});

test('approved read scope does not permit a hold write; a bare agent token does not count as a person', async () => {
  const lab = await fixture();
  const token = await lab.issue(lab.identity.clientId, 'holds:read');
  const url = new URL(site + '/api/holds');
  const denied = await lab.fetcher(url, {
    method: 'POST', headers: {
      Authorization: 'Bearer ' + token, 'Poppy-Version': '1.0',
      'Poppy-Session': await lab.session.sign('POST', url, token),
    },
    body: JSON.stringify({ bookId: 'tideline' }),
  });
  assert.equal(denied.status, 403);
  assert.match(denied.headers.get('www-authenticate'), /holds:write/);
  const bare = await lab.fetcher(url, { headers: { Authorization: 'Bearer ' + token } });
  assert.ok(!bare.ok);
  assert.deepEqual(await lab.store.activity(reader), []);
});

test('direct discovery fails closed until the issuer advertises the Library origin', async () => {
  const lab = await fixture({ advertised: false });
  await assert.rejects(lab.company, /do not establish the configured company identity/);
});
