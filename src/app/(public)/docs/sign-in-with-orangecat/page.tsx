import type { Metadata } from 'next';
import Link from 'next/link';
import { KeyRound, ShieldCheck, Plug, RefreshCw, ArrowRight } from 'lucide-react';
import { PageHeading } from '@/components/layout/PageHeading';
import { ROUTES } from '@/config/routes';
import { OAUTH_SCOPES, OAUTH_TTL } from '@/lib/oauth/config';
import { DCR_LIMITS } from '@/services/auth/oauthRegistration';
import {
  authJsSnippet,
  authorizeSnippet,
  DISCOVERY_PATH,
  meta,
  refreshSnippet,
  registerSnippet,
  SIGN_IN_SCOPE,
  tokenSnippet,
  userinfoSnippet,
} from './snippets';

export const metadata: Metadata = {
  title: 'Sign in with OrangeCat',
  description:
    'Add "Sign in with OrangeCat" to any site in an afternoon: standard OpenID Connect, self-service registration, one identity across every app.',
};

/**
 * /docs/sign-in-with-orangecat — the developer page for the identity provider.
 *
 * OrangeCat has been a real OpenID Connect provider since 2026-06; Solon, Heidi,
 * Loki, Claude.ai and ChatGPT all sign people in through it. Until this page a
 * site that wanted the button had the standard and nothing else. Everything
 * quoted here is derived from the provider's own config (see snippets.ts), so
 * the page cannot drift from what the server does.
 */
function Snippet({ children, label }: { children: string; label: string }) {
  return (
    <figure className="mt-3">
      <figcaption className="mb-1 text-xs font-medium uppercase tracking-caps text-fg-tertiary">
        {label}
      </figcaption>
      <pre className="overflow-x-auto rounded-lg border border-subtle bg-surface-raised p-4 text-xs leading-relaxed text-fg-primary">
        <code>{children}</code>
      </pre>
    </figure>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof KeyRound;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-lg border border-subtle bg-surface-raised p-2">
          <Icon className="h-5 w-5 text-fg-secondary" />
        </div>
        <h2 className="text-2xl font-semibold text-fg-primary">{title}</h2>
      </div>
      <div className="space-y-4 rounded-lg border border-default bg-surface-base p-6 text-fg-secondary leading-relaxed">
        {children}
      </div>
    </section>
  );
}

const accessTokenHours = OAUTH_TTL.accessToken / 3600;
const refreshTokenDays = OAUTH_TTL.refreshToken / 86400;

export default function SignInWithOrangeCatPage() {
  return (
    <div className="min-h-screen bg-surface-page py-12">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-14 text-center">
          <PageHeading className="mb-4">Sign in with OrangeCat</PageHeading>
          <p className="mx-auto max-w-2xl text-xl text-fg-secondary">
            One account for every door. Standard OpenID Connect, self-service registration, and the
            same identity across OrangeCat, Solon, Loki, Heidi and your site.
          </p>
        </div>

        <Section icon={Plug} title="What you get">
          <p>
            OrangeCat is an OpenID Connect provider. Any library that speaks OIDC works unchanged:
            point it at the issuer and discovery fills in the rest.
          </p>
          <Snippet label="Discovery">{`${meta.issuer}${DISCOVERY_PATH}`}</Snippet>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>
              <strong className="text-fg-primary">One identity.</strong> The id token&apos;s{' '}
              <code>sub</code> is the person&apos;s OrangeCat actor id, the same value on every site
              that uses this button. Key your users by it. Never by email: two accounts may share
              one, and a person may change theirs.
            </li>
            <li>
              <strong className="text-fg-primary">Passwords are optional.</strong> People sign in
              with an emailed code, Google, GitHub or a password. Forgotten passwords, recovery and
              account deletion are OrangeCat&apos;s problem, not yours.
            </li>
            <li>
              <strong className="text-fg-primary">People stay in control.</strong> Every app that
              signed in as them is listed under Settings → Integrations → Connected apps, with a
              Disconnect button. Honour it (see &ldquo;Sessions&rdquo; below).
            </li>
            <li>
              <strong className="text-fg-primary">Claims.</strong>{' '}
              {meta.claims_supported.join(', ')}. Scope <code>{SIGN_IN_SCOPE}</code> is all a
              sign-in needs.
            </li>
          </ul>
        </Section>

        <Section icon={KeyRound} title="Register your app">
          <p>
            <strong className="text-fg-primary">Self-service, right now.</strong> One request
            registers a public client (RFC 7591). No account, no review, no waiting.
          </p>
          <Snippet label="Register">{registerSnippet}</Snippet>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>
              Redirect URIs must be <code>https</code>, or <code>http</code> on localhost for a
              native app. At most {DCR_LIMITS.maxRedirectUris}. Exact match, no wildcards.
            </li>
            <li>
              No client secret is issued; PKCE (S256) binds each code to the app that asked for it.
            </li>
            <li>
              The consent screen always shows for a self-registered app, says it is unverified, and
              names the host it will send the person back to. Your app&apos;s name is trimmed to{' '}
              {DCR_LIMITS.maxClientNameLength} characters; logos and homepage URLs are not shown.
            </li>
          </ul>
          <p>
            <strong className="text-fg-primary">Verified client.</strong> Once your site is live,{' '}
            <Link href={ROUTES.SUPPORT} className="text-fg-primary underline">
              ask for a verified client
            </Link>
            : a confidential client with a secret (<code>client_secret_post</code>), your name shown
            without the warning, and consent remembered so returning people skip the screen.
          </p>
        </Section>

        <Section icon={ShieldCheck} title="Add the button">
          <p>
            Label it{' '}
            <strong className="text-fg-primary">&ldquo;Sign in with OrangeCat&rdquo;</strong>, or{' '}
            <strong className="text-fg-primary">&ldquo;Create an account&rdquo;</strong> with{' '}
            <code>prompt=create</code> where the person is new. Add <code>login_hint</code> when you
            already know the email; OrangeCat opens with it filled in.
          </p>
          <Snippet label="Auth.js (Next.js) — what Solon, Heidi and Loki run">
            {authJsSnippet}
          </Snippet>
          <Snippet label="Any OIDC library, or by hand — 1. send the person to">
            {authorizeSnippet}
          </Snippet>
          <Snippet label="2. exchange the code">{tokenSnippet}</Snippet>
          <Snippet label="3. read the profile (or decode the id token)">{userinfoSnippet}</Snippet>
          <p className="text-sm">
            Verify id tokens against <code>{meta.jwks_uri}</code> (RS256). Always send{' '}
            <code>state</code> and PKCE; send <code>nonce</code> and check it in the id token.
          </p>
        </Section>

        <Section icon={RefreshCw} title="Sessions, and taking access back">
          <p>
            Access tokens live {accessTokenHours} hour{accessTokenHours === 1 ? '' : 's'}; refresh
            tokens {refreshTokenDays} days and rotate on every use. Store the refresh token and the
            expiry with your session, and refresh when the access token runs out:
          </p>
          <Snippet label="Refresh">{refreshSnippet}</Snippet>
          <p>
            <strong className="text-fg-primary">
              <code>invalid_grant</code> means the person disconnected your app
            </strong>{' '}
            (or signed out everywhere, or deleted their account). End their session on your site and
            send them back to the button. Any other failure is transient: keep the session and try
            again shortly. A session that never refreshes outlives the person&apos;s decision; that
            is the one mistake to avoid.
          </p>
        </Section>

        <Section icon={KeyRound} title="Scopes">
          <p className="text-sm">
            A sign-in needs only the standard three. The rest let an app act for the person and are
            shown on the consent screen in these words:
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {OAUTH_SCOPES.map(s => (
              <li key={s.name} className="rounded-lg bg-surface-raised p-3 text-sm">
                <code className="text-fg-primary">{s.name}</code>
                <p className="mt-0.5 text-xs text-fg-secondary">{s.description}</p>
              </li>
            ))}
          </ul>
        </Section>

        <div className="rounded-lg border border-default bg-surface-base p-6 text-center">
          <p className="text-fg-secondary">
            Try the whole round trip from a terminal before you write a line:{' '}
            <code>node scripts/oauth/sign-in-roundtrip.mjs</code> in the{' '}
            <a
              href="https://github.com/bitbaum/orangecat"
              className="text-fg-primary underline"
              rel="noopener"
            >
              OrangeCat repository
            </a>{' '}
            registers a client, opens the sign-in, exchanges the code, reads the profile and
            refreshes.
          </p>
          <Link
            href={ROUTES.SUPPORT}
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-fg-primary"
          >
            Questions, or a verified client <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
