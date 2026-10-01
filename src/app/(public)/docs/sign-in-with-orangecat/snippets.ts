/**
 * The code a developer copies from /docs/sign-in-with-orangecat.
 *
 * Every URL, scope and lifetime here is DERIVED from the same config the
 * authorization server runs on, so the page cannot quote an endpoint the
 * server does not serve. The test next door pins that.
 */
import { buildAuthorizationServerMetadata } from '@/lib/oauth/metadata';
import { OAUTH_PATHS, STANDARD_SCOPE_NAMES } from '@/lib/oauth/config';
import { DCR_LIMITS } from '@/services/auth/oauthRegistration';

export const meta = buildAuthorizationServerMetadata();

/** The three scopes a plain sign-in needs — the same set Solon and Heidi ask for. */
export const SIGN_IN_SCOPE = STANDARD_SCOPE_NAMES.join(' ');

/** Register a public client with one request (RFC 7591). */
export const registerSnippet = `curl -s ${meta.registration_endpoint} \\
  -H 'content-type: application/json' \\
  -d '{
    "client_name": "My app",
    "redirect_uris": ["https://my-app.example/auth/callback/orangecat"],
    "policy_uri": "https://my-app.example/privacy",
    "tos_uri": "https://my-app.example/terms",
    "token_endpoint_auth_method": "none"
  }'
# → { "client_id": "${DCR_LIMITS.clientIdPrefix}…", "redirect_uris": [...], ... }`;

/** Auth.js v5 — what Solon, Heidi and Loki run in production. */
export const authJsSnippet = `import NextAuth from "next-auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    {
      id: "orangecat",
      name: "OrangeCat",
      type: "oidc",
      issuer: "${meta.issuer}",          // discovery does the rest
      clientId: process.env.ORANGECAT_OAUTH_CLIENT_ID!,
      clientSecret: process.env.ORANGECAT_OAUTH_CLIENT_SECRET, // omit for a self-registered (public) client
      client: { token_endpoint_auth_method: "client_secret_post" }, // "none" for a public client
      checks: ["pkce", "state"],
      authorization: { params: { scope: "${SIGN_IN_SCOPE}" } },
    },
  ],
  callbacks: {
    jwt({ token, profile, account }) {
      // id_token.sub is the OrangeCat actor id: the ONLY key that identifies
      // a person across sites. Never link accounts by email.
      if (profile?.sub) token.actorId = profile.sub;
      if (account?.provider === "orangecat") {
        token.ocRefreshToken = account.refresh_token;
        token.ocExpiresAt = account.expires_at;
      }
      return token;
    },
    session({ session, token }) {
      session.actorId = token.actorId as string | undefined;
      return session;
    },
  },
});`;

/** Any OIDC library, or by hand: authorization code + PKCE. */
export const authorizeSnippet = `${meta.authorization_endpoint}
  ?response_type=code
  &client_id=YOUR_CLIENT_ID
  &redirect_uri=https%3A%2F%2Fmy-app.example%2Fauth%2Fcallback%2Forangecat
  &scope=${encodeURIComponent(SIGN_IN_SCOPE)}
  &state=RANDOM_STATE
  &nonce=RANDOM_NONCE
  &code_challenge=BASE64URL(SHA256(code_verifier))
  &code_challenge_method=S256
  # optional: &prompt=create  (open on "Create an account")
  #           &login_hint=someone%40example.org`;

export const tokenSnippet = `curl -s ${meta.token_endpoint} \\
  -d grant_type=authorization_code \\
  -d code=THE_CODE \\
  -d redirect_uri=https://my-app.example/auth/callback/orangecat \\
  -d client_id=YOUR_CLIENT_ID \\
  -d code_verifier=THE_VERIFIER \\
  # confidential clients add: -d client_secret=YOUR_SECRET
# → { "access_token", "id_token", "refresh_token", "expires_in", "token_type": "Bearer" }`;

export const refreshSnippet = `curl -s ${meta.token_endpoint} \\
  -d grant_type=refresh_token \\
  -d refresh_token=THE_REFRESH_TOKEN \\
  -d client_id=YOUR_CLIENT_ID
# 200 → a NEW refresh_token (the old one is spent) and a new access_token
# 400 {"error":"invalid_grant"} → the person disconnected your app. End their session.`;

export const userinfoSnippet = `curl -s ${meta.userinfo_endpoint} -H "Authorization: Bearer $ACCESS_TOKEN"
# → { "sub": "<actor id>", "name", "preferred_username", "picture", "email" }`;

export const DISCOVERY_PATH = OAUTH_PATHS.discovery;
