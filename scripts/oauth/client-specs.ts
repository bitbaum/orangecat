/**
 * The registered OAuth relying parties — one least-privilege SSOT per client.
 *
 * Pure data, importable without the owner gate, so two things can read it:
 * register-client.ts (creates or refreshes a row, by hand, owner-gated) and
 * client-scopes-sql.ts (run by every deploy: brings the scope ceiling of every
 * EXISTING row in line with this file, creating nothing). Before the second
 * reader existed, widening a client's scopes here changed nothing on the live
 * sign-in until someone remembered to re-run the registration on the box.
 *
 * - scopes: only what the client actually needs today. NOT the full supported
 *   set — `effectiveScopes()` narrows per-request, but the *ceiling* stays
 *   minimal so a token can never be minted for a capability the client
 *   shouldn't have. Widen here intentionally when one needs a new capability.
 * - origins: exact-match redirect enforcement (no wildcards). Append
 *   dev/preview origins via <ID>_REDIRECT_URIS when registering.
 */

import { parseAndValidateScopes } from '../../src/lib/oauth/config';

/** Auth.js v5 callback path — identical for every relying party we register. */
export const CALLBACK_PATH = '/api/auth/callback/orangecat';

export interface ClientSpec {
  name: string;
  /** Production origins; the callback path is appended to each. */
  origins: string[];
  /** Space-separated scope ceiling — validated against the scope registry. */
  scopes: string;
  is_confidential: boolean;
  is_trusted: boolean;
  /**
   * The app's own privacy policy / terms, linked from the consent screen.
   * Only a page that exists — the screen says "none published" otherwise.
   */
  policy_uri?: string;
  tos_uri?: string;
}

/**
 * The registered relying parties — one least-privilege SSOT per client.
 *
 * - scopes: only what the client actually needs today. NOT the full supported
 *   set — `effectiveScopes()` narrows per-request, but the *ceiling* stays
 *   minimal so a token can never be minted for a capability the client
 *   shouldn't have. Widen here intentionally (and re-run) when one needs a
 *   new capability.
 * - origins: exact-match redirect enforcement (no wildcards). Append
 *   dev/preview origins via <ID>_REDIRECT_URIS when needed.
 */
export const CLIENT_SPECS: Record<string, ClientSpec> = {
  // Mirrors the row first registered + go-live-verified on 2026-06-17; the
  // secret already lives in Loki's env.
  loki: {
    name: 'Loki',
    origins: ['https://loki.orangecat.ch'], // production origin (PLATFORM_AND_COLLABORATION.md)
    policy_uri: 'https://loki.orangecat.ch/privacy',
    tos_uri: 'https://loki.orangecat.ch/terms',
    // service.write (2026-10-20): a builder booked through Loki is paid through
    // a service in the builder's own name — Loki lists it with the builder's
    // token, so the money lands in the builder's wallet, never the studio's.
    scopes:
      'openid profile email project.read project.write service.write timeline.write wallet.read',
    is_confidential: true, // has a server (Auth.js v5) — keeps a secret
    is_trusted: true, // first-party — skips the consent screen after first grant
  },
  // Solon needs IDENTITY and nothing else: login links a Solon member to an
  // OrangeCat actor (Member.ocActorId). It never acts on OrangeCat's behalf —
  // governance authority flows the other way, through Bitcoin-signed votes
  // that OrangeCat re-verifies (src/services/solon/decision-verify.ts).
  solon: {
    name: 'Solon',
    origins: ['https://solon.orangecat.ch'],
    scopes: 'openid profile email',
    is_confidential: true,
    is_trusted: true,
  },
  // Heidi needs IDENTITY and nothing else, for the same reason Solon does.
  // Heidi teaches Swiss German; its portal has learners, tutors who can be
  // paid, and study groups — and each of those is something OrangeCat already
  // owns (identity, economy, public presence). So Heidi keeps NO users table
  // and acts on nobody's behalf: it reads who you are and stops there.
  // Widen this ceiling deliberately, here, if tutor payouts later need a
  // wallet scope — never by letting the client ask for more at request time.
  heidi: {
    name: 'Heidi',
    origins: ['https://heidi.orangecat.ch'],
    policy_uri: 'https://heidi.orangecat.ch/privacy', // no terms page yet
    scopes: 'openid profile email',
    is_confidential: true, // has a server (Auth.js v5) — keeps a secret
    is_trusted: true, // first-party — skips the consent screen after first grant
  },
  // Skif (safety: bookable Protectors, safety assessments) needs IDENTITY and
  // nothing else. It keeps no users table — `sub` is the only key it stores —
  // and it holds some of the most sensitive data in the fleet (bookings,
  // incident reports, a person's stated safety limits), which is exactly why
  // it must not be able to read or act on anything else at OrangeCat.
  skif: {
    name: 'Skif',
    origins: ['https://skif.orangecat.ch'],
    scopes: 'openid profile email',
    is_confidential: true, // has a server (Auth.js v5) — keeps a secret
    is_trusted: true, // first-party — skips the consent screen after first grant
  },
  // Substrata (research on physical chokepoints) needs IDENTITY and nothing
  // else: the signed `sub` keys a reader's desk settings and marks. It was
  // registered by hand before this entry existed, so a re-run would have had
  // nothing to refresh. Two origins: it moves to substrata.ch and the
  // orangecat.ch address keeps working, so sign-in must be accepted on both.
  substrata: {
    name: 'Substrata',
    origins: ['https://substrata.ch', 'https://substrata.orangecat.ch'],
    scopes: 'openid profile email',
    is_confidential: true, // has a server (Auth.js v5) — keeps a secret
    is_trusted: true, // first-party — skips the consent screen after first grant
  },
  // 2026-10-02 — George: "move all our own products to sign in with
  // orangecat". These four ran their own email/password logins, so a new
  // person had no Google or GitHub and an OrangeCat account bought them
  // nothing. IDENTITY only, like heidi and skif: each keys its users on
  // `sub` and links no account by email (email_verified cannot be trusted
  // while GoTrue auto-confirms sign-ups). policy_uri/tos_uri only where the
  // page exists — curl-checked the same day.
  evig: {
    name: 'evig',
    // Serves both names; sign-in must be accepted on either.
    origins: ['https://evig.orangecat.ch', 'https://revampit.orangecat.ch'],
    policy_uri: 'https://evig.orangecat.ch/datenschutz',
    tos_uri: 'https://evig.orangecat.ch/agb',
    scopes: 'openid profile email',
    is_confidential: true,
    is_trusted: true,
  },
  petvity: {
    name: 'Petvity',
    origins: ['https://petvity.orangecat.ch'],
    scopes: 'openid profile email',
    is_confidential: true,
    is_trusted: true,
  },
  'surf-your-life': {
    name: 'Surf Your Life',
    origins: ['https://surf-your-life.orangecat.ch'],
    policy_uri: 'https://surf-your-life.orangecat.ch/de/privacy',
    scopes: 'openid profile email',
    is_confidential: true,
    is_trusted: true,
  },
  datacat: {
    name: 'Datacat',
    origins: ['https://datacat.orangecat.ch'],
    scopes: 'openid profile email',
    is_confidential: true,
    is_trusted: true,
  },
  // Causius (legal matters worked by an agent) needs IDENTITY and nothing
  // else. It keeps no users table: the signed `sub` is the only key it stores,
  // and a person's display name is sealed inside their matters, never kept in
  // the clear. It holds legal letters, so it must not be able to read or act
  // on anything else here. Paying helpers will widen this deliberately, here.
  causius: {
    name: 'Causius',
    origins: ['https://causius.orangecat.ch'],
    scopes: 'openid profile email',
    is_confidential: true, // has a server (Auth.js v5) — keeps a secret
    is_trusted: true, // first-party — skips the consent screen after first grant
  },
  // 2026-11-01 — the owner: every fleet app offers every sign-in method on
  // every auth page, "Continue with OrangeCat" included. These are the apps
  // with a sign-in page and no client (bitbaum/fleet
  // docs/auth-parity-2026-11-01.md). IDENTITY only, like heidi and skif.
  // Their rows are created by the deploy switched off and with no secret
  // (clientRowInserts); loki `app-secrets.sh` (kind oc-client) writes the
  // secret into the app's env and its sha256 here, and switches the row on —
  // nobody reads or pastes it. Origins are loki apps.conf's. policy_uri only
  // where the page exists (curl-checked 2026-11-01: kivvi alone).
  'aoz-begleitung': {
    name: 'AOZ Begleitung',
    origins: ['https://aoz.orangecat.ch'],
    scopes: 'openid profile email',
    is_confidential: true,
    is_trusted: true,
  },
  biaslens: {
    name: 'BiasLens',
    origins: ['https://biaslens.orangecat.ch'],
    // Both pages answered 200 when this was added (bitbaum/biaslens #206).
    policy_uri: 'https://biaslens.orangecat.ch/privacy',
    tos_uri: 'https://biaslens.orangecat.ch/terms',
    scopes: 'openid profile email',
    is_confidential: true,
    is_trusted: true,
  },
  botsmann: {
    name: 'Botsmann',
    origins: ['https://botsmann.orangecat.ch'],
    scopes: 'openid profile email',
    is_confidential: true,
    is_trusted: true,
  },
  diplodoctor: {
    name: 'Diplodoctor',
    origins: ['https://diplodoctor.orangecat.ch'],
    scopes: 'openid profile email',
    is_confidential: true,
    is_trusted: true,
  },
  // One codebase on two hosts (loki apps.conf revamp-info row); sign-in must be
  // accepted on either.
  hirnli: {
    name: 'hirnli',
    origins: ['https://hirnli.orangecat.ch', 'https://revamp-info.orangecat.ch'],
    scopes: 'openid profile email',
    is_confidential: true,
    is_trusted: true,
  },
  keller: {
    name: 'Keller',
    origins: ['https://keller.orangecat.ch'],
    scopes: 'openid profile email',
    is_confidential: true,
    is_trusted: true,
  },
  kivvi: {
    name: 'Kivvi',
    origins: ['https://kivvi.orangecat.ch'],
    policy_uri: 'https://kivvi.orangecat.ch/datenschutz',
    scopes: 'openid profile email',
    is_confidential: true,
    is_trusted: true,
  },
  printcraft: {
    name: 'PrintCraft',
    origins: ['https://printcraft.orangecat.ch'],
    scopes: 'openid profile email',
    is_confidential: true,
    is_trusted: true,
  },
  'reparaturbonus-zh': {
    name: 'Reparaturbonus Zürich',
    origins: ['https://reparaturbonus.orangecat.ch'],
    scopes: 'openid profile email',
    is_confidential: true,
    is_trusted: true,
  },
  // Vita serves vita.orangecat.ch and keeps vitareba.orangecat.ch (apps.conf).
  vitareba: {
    name: 'Vita',
    origins: ['https://vita.orangecat.ch', 'https://vitareba.orangecat.ch'],
    scopes: 'openid profile email',
    is_confidential: true,
    is_trusted: true,
  },
};

/** A client's scope ceiling as the registry knows it; unknown names are a bug, not a row. */
export function clientScopes(clientId: string): string[] {
  const spec = CLIENT_SPECS[clientId];
  if (!spec) {
    throw new Error(`Unknown client "${clientId}"`);
  }
  const { granted, unknown } = parseAndValidateScopes(spec.scopes);
  if (unknown.length) {
    throw new Error(`Unknown scope(s) for "${clientId}": ${unknown.join(', ')}`);
  }
  return granted;
}

const sqlLiteral = (s: string): string => `'${s.replace(/'/g, "''")}'`;

/**
 * One INSERT per registered client that has no row yet: switched off
 * (`disabled_at` set) and with no secret, so it can sign nobody in. getClient
 * reads only enabled rows, and a confidential client with no secret hash fails
 * verifyClientSecret, twice inert. It exists so that loki `app-secrets.sh`
 * can give it a secret ON THE BOX, writing the app's env and this row's hash
 * in one step without printing either; register-client.ts, by hand, remains
 * the other way. An existing row is never touched here.
 */
export function clientRowInserts(): string[] {
  return Object.entries(CLIENT_SPECS).map(([clientId, spec]) => {
    const scopes = `ARRAY[${clientScopes(clientId).map(sqlLiteral).join(', ')}]::text[]`;
    const redirects = `ARRAY[${spec.origins.map(o => sqlLiteral(`${o}${CALLBACK_PATH}`)).join(', ')}]::text[]`;
    const uri = (u?: string) => (u ? sqlLiteral(u) : 'NULL');
    return (
      'INSERT INTO public.oauth_clients (client_id, client_secret_hash, name, redirect_uris, allowed_scopes, is_confidential, is_trusted, policy_uri, tos_uri, disabled_at) ' +
      `SELECT ${sqlLiteral(clientId)}, NULL, ${sqlLiteral(spec.name)}, ${redirects}, ${scopes}, ${spec.is_confidential}, ${spec.is_trusted}, ${uri(spec.policy_uri)}, ${uri(spec.tos_uri)}, now() ` +
      `WHERE NOT EXISTS (SELECT 1 FROM public.oauth_clients WHERE client_id = ${sqlLiteral(clientId)});`
    );
  });
}

/**
 * One UPDATE per registered client, each a no-op when the row already matches.
 * Only rows that exist change; a missing row is created by clientRowInserts,
 * switched off and secretless.
 */
export function clientScopeUpdates(): string[] {
  return Object.keys(CLIENT_SPECS).map(clientId => {
    const scopes = `ARRAY[${clientScopes(clientId).map(sqlLiteral).join(', ')}]::text[]`;
    return `UPDATE public.oauth_clients SET allowed_scopes = ${scopes} WHERE client_id = ${sqlLiteral(clientId)} AND allowed_scopes IS DISTINCT FROM ${scopes};`;
  });
}

/**
 * One UPDATE per client whose spec names a privacy policy or terms, each a
 * no-op when the row already says the same. Before this, a link added here
 * reached the consent screen only when someone re-ran register-client.ts on
 * the box, so a page could exist for weeks while OrangeCat told people the
 * app had "not published a privacy policy or terms". A client with neither
 * in its spec is left alone. Like register-client.ts, the spec is the whole
 * answer for a client it names: a link it omits is cleared.
 */
export function clientDocumentUpdates(): string[] {
  const uri = (u?: string) => (u ? sqlLiteral(u) : 'NULL');
  return Object.entries(CLIENT_SPECS)
    .filter(([, spec]) => spec.policy_uri || spec.tos_uri)
    .map(([clientId, spec]) => {
      const policy = uri(spec.policy_uri);
      const tos = uri(spec.tos_uri);
      return (
        `UPDATE public.oauth_clients SET policy_uri = ${policy}, tos_uri = ${tos} ` +
        `WHERE client_id = ${sqlLiteral(clientId)} ` +
        `AND (policy_uri IS DISTINCT FROM ${policy} OR tos_uri IS DISTINCT FROM ${tos});`
      );
    });
}
