#!/usr/bin/env node
/* eslint-disable no-console -- a CLI talks through stdout */
/**
 * Sign in with OrangeCat — the whole round trip from a terminal.
 *
 * Registers a public client (RFC 7591), opens the sign-in in your browser,
 * catches the code on a loopback port, exchanges it with PKCE, reads the
 * profile, refreshes once, and prints what a relying party would store.
 * Nothing here is OrangeCat-internal: this is exactly what any site does.
 *
 *   node scripts/oauth/sign-in-roundtrip.mjs                 # against production
 *   ISSUER=http://localhost:3000 node scripts/oauth/sign-in-roundtrip.mjs
 *   NO_OPEN=1 node scripts/oauth/sign-in-roundtrip.mjs       # print the URL instead of opening it
 *
 * Exit code 0 means every step answered as the developer page says it will.
 */
import crypto from 'node:crypto';
import http from 'node:http';
import { spawn } from 'node:child_process';

const ISSUER = (process.env.ISSUER ?? 'https://orangecat.ch').replace(/\/$/, '');
const PORT = Number(process.env.PORT ?? 8765);
const REDIRECT = `http://127.0.0.1:${PORT}/callback`;
const log = (...a) => console.log(...a);
const fail = msg => {
  console.error('✗', msg);
  process.exit(1);
};

// 1. Discovery.
const meta = await (await fetch(`${ISSUER}/.well-known/openid-configuration`)).json();
if (meta.issuer !== ISSUER) {
  fail(`discovery issuer ${meta.issuer} != ${ISSUER}`);
}
log('✓ discovery', meta.authorization_endpoint);

// 2. Register a public client.
const reg = await (
  await fetch(meta.registration_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Round-trip check',
      redirect_uris: [REDIRECT],
      token_endpoint_auth_method: 'none',
    }),
  })
).json();
if (!reg.client_id) {
  fail(`registration refused: ${JSON.stringify(reg)}`);
}
log('✓ registered', reg.client_id);

// 3. Authorization request with PKCE, state and nonce.
const verifier = crypto.randomBytes(32).toString('base64url');
const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
const state = crypto.randomBytes(12).toString('base64url');
const nonce = crypto.randomBytes(12).toString('base64url');
const authorize = new URL(meta.authorization_endpoint);
for (const [k, v] of Object.entries({
  response_type: 'code',
  client_id: reg.client_id,
  redirect_uri: REDIRECT,
  scope: 'openid profile email',
  state,
  nonce,
  code_challenge: challenge,
  code_challenge_method: 'S256',
})) {
  authorize.searchParams.set(k, v);
}

const callback = new Promise(resolve => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, REDIRECT);
    if (url.pathname !== '/callback') {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': 'text/plain' }).end('Signed in. You can close this tab.');
    server.close();
    resolve(Object.fromEntries(url.searchParams));
  });
  server.listen(PORT, '127.0.0.1');
});

log('\nOpen this in your browser and sign in:\n\n  ' + authorize.toString() + '\n');
if (!process.env.NO_OPEN) {
  const opener =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  spawn(opener, [authorize.toString()], { stdio: 'ignore', detached: true }).on('error', () => {});
}

const cb = await callback;
if (cb.error) {
  fail(`authorization refused: ${cb.error} ${cb.error_description ?? ''}`);
}
if (cb.state !== state) {
  fail('state mismatch — someone else sent this code');
}
log('✓ code received, state matches');

// 4. Exchange the code.
const post = body =>
  fetch(meta.token_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  }).then(async r => ({ status: r.status, body: await r.json() }));

const tokens = await post({
  grant_type: 'authorization_code',
  code: cb.code,
  redirect_uri: REDIRECT,
  client_id: reg.client_id,
  code_verifier: verifier,
});
if (tokens.status !== 200) {
  fail(`token exchange: ${tokens.status} ${JSON.stringify(tokens.body)}`);
}
const idToken = JSON.parse(Buffer.from(tokens.body.id_token.split('.')[1], 'base64url').toString());
if (idToken.iss !== ISSUER) {
  fail(`id_token iss ${idToken.iss}`);
}
if (idToken.aud !== reg.client_id) {
  fail(`id_token aud ${idToken.aud}`);
}
if (idToken.nonce !== nonce) {
  fail('id_token nonce mismatch');
}
log('✓ tokens issued; id_token sub =', idToken.sub, `(expires_in ${tokens.body.expires_in}s)`);

// 5. Profile.
const me = await (
  await fetch(meta.userinfo_endpoint, {
    headers: { authorization: `Bearer ${tokens.body.access_token}` },
  })
).json();
if (me.sub !== idToken.sub) {
  fail(`userinfo sub ${me.sub} != id_token sub ${idToken.sub}`);
}
log('✓ userinfo', JSON.stringify(me));

// 6. Refresh — rotates.
const refreshed = await post({
  grant_type: 'refresh_token',
  refresh_token: tokens.body.refresh_token,
  client_id: reg.client_id,
});
if (refreshed.status !== 200 || !refreshed.body.refresh_token) {
  fail(`refresh: ${refreshed.status} ${JSON.stringify(refreshed.body)}`);
}
const reused = await post({
  grant_type: 'refresh_token',
  refresh_token: tokens.body.refresh_token,
  client_id: reg.client_id,
});
if (reused.status !== 400 || reused.body.error !== 'invalid_grant') {
  fail(`a spent refresh token must be refused with invalid_grant, got ${reused.status}`);
}
log('✓ refresh rotated; the spent token is refused with invalid_grant');

log('\nStore for this person:');
log(
  JSON.stringify(
    {
      sub: idToken.sub,
      refresh_token: '<rotated>',
      expires_at: Math.floor(Date.now() / 1000) + refreshed.body.expires_in,
    },
    null,
    2
  )
);
log(
  '\nDisconnect this app under Settings → Integrations → Connected apps: the next refresh answers invalid_grant.'
);
