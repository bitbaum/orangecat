# Connectors: GitHub and Google

**Audience:** whoever operates OrangeCat on `bitbaum`.
**In short:** a person can connect their GitHub and their Google account in
Cat → Controls ("What your Cat sees"). Their Cat and their own bots can then
read those accounts on request: `github_read`, `gmail_read`, `calendar_read`
(`src/services/connectors/hands.ts`). Everything is read-only. Both
connections stay inert until their keys are in `/opt/orangecat/app/.env`.

## What each connection needs on the server

| Connection | Variables                                                             | Read by                                 |
| ---------- | --------------------------------------------------------------------- | --------------------------------------- |
| GitHub     | `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_SLUG` | `src/services/github/connection.ts`     |
| Google     | `GOOGLE_CONNECT_CLIENT_ID`, `GOOGLE_CONNECT_CLIENT_SECRET`            | `src/services/google/connection.ts`     |
| Both       | `WEBHOOK_SECRET_KEY` (encrypts the stored tokens)                     | `src/lib/crypto/webhookSecretCipher.ts` |

Without its variables a connection is not offered: GitHub falls back to the
public repositories of a profile handle, and Google shows "Status
unavailable" with no button.

## GitHub

A GitHub App, not an OAuth App; why, and the install flow, are written at the
top of `src/services/github/connection.ts`. Its callback URL is
`https://orangecat.ch/api/integrations/github/callback`. `github_read` lists
repositories, open issues and open pull requests and reads one file, so the
app needs read access to metadata, contents, issues and pull requests; a read
the app has no permission for answers that the repository is not shared.

## Google

An OAuth client of type "Web application" in a Google Cloud project:

1. Enable the Gmail API and the Google Calendar API in the project.
2. Create the OAuth client with the redirect URI
   `https://orangecat.ch/api/integrations/google/callback`.
3. On the consent screen add the two scopes the app asks for
   (`GOOGLE_SCOPES`): `gmail.readonly` and `calendar.readonly`.
4. Put the client id and secret in `/opt/orangecat/app/.env` and restart.

This is a separate client from the one "Sign in with Google" uses (that one
lives in GoTrue, `docs/operations/oauth-social-login.md`), so a change here
cannot break sign-in.

What Google's own pages say about such a client, read 2026-11-13:

- `gmail.readonly` is listed under "Restricted scopes"
  ([Gmail API scopes](https://developers.google.com/workspace/gmail/api/auth/scopes)).
- While the consent screen's publishing status is "Testing", a refresh token
  expires seven days after consent, and the project is limited to 100 test
  users ([Using OAuth 2.0](https://developers.google.com/identity/protocols/oauth2),
  [Manage App Audience](https://support.google.com/cloud/answer/15549945)).

So in "Testing" a connected person has to reconnect every week, and a bot's
routine that reads mail stops after seven days until they do. The read then
says the connection has lapsed and where to reconnect; nothing fails
silently. Lifting that limit means publishing the app, which for a
restricted scope goes through Google's verification.

## What is stored, and how it ends

One row per person per provider in `cat_connection_tokens`: the access and
refresh tokens, encrypted, readable by the service role only
(`src/services/connectors/token-store.ts`). Disconnecting in Cat → Controls
deletes the row; for Google it also asks Google to cancel the token.
