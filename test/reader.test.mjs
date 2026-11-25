import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AccessTokenError, AccessTokenErrorCode } from '@auth0/nextjs-auth0/errors';
import { Auth0Client } from '@auth0/nextjs-auth0/server';
import { renderToStaticMarkup } from 'react-dom/server';
import MyHolds from '../app/my-holds/page.tsx';
import { readerHolds } from '../lib/reader.ts';

test('an expired reader token without a refresh token returns 401 and offers sign-in again', async (t) => {
  for (const [key, value] of Object.entries({
    AUTH0_DOMAIN: 'auth.example.com',
    AUTH0_CLIENT_ID: 'fixture-reader',
    AUTH0_CLIENT_SECRET: 'fixture-client-secret',
    AUTH0_SECRET: '00'.repeat(32),
    AUTH0_AUDIENCE: 'https://library.example.com',
    APP_BASE_URL: 'https://library.example.com',
  })) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
  t.mock.method(Auth0Client.prototype, 'getSession', async () => ({ user: { sub: 'fixture-reader' } }));
  const getAccessToken = t.mock.method(Auth0Client.prototype, 'getAccessToken', async () => {
    throw new AccessTokenError(AccessTokenErrorCode.MISSING_REFRESH_TOKEN, 'Reader must sign in again.');
  });

  assert.equal((await readerHolds('GET')).status, 401);
  assert.equal((await readerHolds('POST', 'tideline')).status, 401);
  const page = await MyHolds({ searchParams: Promise.resolve({ book: 'tideline' }) });
  const html = renderToStaticMarkup(page);
  assert.match(html, /href="\/auth\/login\?returnTo=%2Fmy-holds%3Fbook%3Dtideline"/);
  assert.doesNotMatch(html, /Holds are unavailable|Place hold/);
  assert.equal(getAccessToken.mock.callCount(), 3);
});
