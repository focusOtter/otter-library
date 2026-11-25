import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { exportJWK, generateKeyPair } from 'jose';
import { callbackUrl, createIdentity, createSession, discover, startSignIn } from './protocol.mjs';
import { createLibrary, runLibrary } from './library.mjs';

async function approve(transaction) {
  const local = new URL(callbackUrl);
  const { promise, resolve, reject } = Promise.withResolvers();
  const headers = {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer',
  };
  const server = createServer(async (request, response) => {
    const url = new URL(local.origin + request.url);
    if (request.method !== 'GET' || url.pathname !== local.pathname) return response.writeHead(404).end();
    try {
      const grant = await transaction.complete(url);
      response.writeHead(200, headers).end('<!doctype html><title>Library approval</title><script>history.replaceState(null,"",location.pathname)</script><p>Agent approved. Return to the terminal.</p>');
      resolve(grant);
    } catch (error) {
      response.writeHead(400, headers).end('<!doctype html><title>Library approval</title><script>history.replaceState(null,"",location.pathname)</script><p>Approval did not complete. Restart the agent to try again.</p>');
      reject(error);
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(Number(local.port), local.hostname, resolve);
  });
  const timer = setTimeout(() => reject(Error('Approval timed out.')), 300000);
  try {
    const open = { linux: 'xdg-open', darwin: 'open' }[process.platform];
    if (!open) throw Error('Use a desktop browser on Linux or macOS.');
    const browser = spawn(open, [transaction.url.href], { stdio: 'ignore' });
    browser.once('error', reject);
    browser.once('exit', (code) => { if (code) reject(Error('Could not open the approval browser.')); });
    console.log('Approval: waiting for browser');
    return await promise;
  } finally {
    clearTimeout(timer);
    await new Promise((done) => {
      server.close(done);
      server.closeAllConnections();
    });
  }
}

async function main() {
  const [mode, ...args] = process.argv.slice(2);
  const site = process.env.AGENT_ORIGIN;
  const keyPath = process.env.AGENT_KEY_FILE;
  if (mode !== 'keygen' && mode !== 'hold') throw Error('Choose keygen or hold.');
  if (!site || !keyPath) throw Error('Set AGENT_ORIGIN and AGENT_KEY_FILE.');
  if (mode === 'keygen') {
    const { privateKey } = await generateKeyPair('ES256', { extractable: true });
    const jwk = await exportJWK(privateKey);
    const identity = await createIdentity(site, jwk);
    await writeFile(keyPath, JSON.stringify(jwk), { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify(identity.jwks.keys[0]));
    return;
  }
  const issuer = process.env.AGENT_ISSUER;
  const pairwise = process.env.AGENT_PAIRWISE_SECRET;
  const prompt = args.join(' ').trim();
  if (!issuer || !pairwise || !prompt) throw Error('Set AGENT_ISSUER and AGENT_PAIRWISE_SECRET and supply a prompt.');
  const identity = await createIdentity(site, JSON.parse(await readFile(keyPath, 'utf8')));
  const company = await discover({ store: site, api: site, audience: process.env.AUTH0_AUDIENCE || undefined, issuer });
  const library = createLibrary(company, await createSession(identity, issuer, pairwise), {
    onResponse: ({ method, path, status }) => console.log(`${method} ${path}: HTTP ${status}`),
  });
  globalThis.AI_SDK_LOG_WARNINGS = false;
  await runLibrary(library, { prompt, approve: async (scopes) => approve(await startSignIn(company, identity, scopes, {
    onTokenResponse: (status) => console.log(`Auth0 /oauth/token: HTTP ${status}`),
  })) });
  console.log('Agent: finished');
}

main().catch(() => {
  console.error('Agent setup or run failed. No credentials or approval URL were logged.');
  process.exitCode = 1;
});
