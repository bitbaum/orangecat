/**
 * /auth — resolves which app, if any, sent the person here, then renders the
 * sign-in screen. The client id arrives in the URL (see lib/oauth/handoff.ts);
 * its display name is looked up here so the screen never shows a name someone
 * typed into a link.
 */
import { getClient } from '@/services/auth/oauthProvider';
import { readHandoff } from '@/lib/oauth/handoff';
import { isEmailConfigured } from '@/lib/email/client';
import { arePasskeysEnabled } from '@/lib/auth/passkeys-availability';
import AuthPageClient from './AuthPageClient';

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { client } = readHandoff({
    get: name => {
      const v = sp[name];
      return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
    },
  });
  const found = client ? await getClient(client) : null;
  // Offer sign-in by emailed code only where this deployment can actually send
  // the email — a button that can never deliver is a dead end.
  // Same rule for passkeys: offered only where the auth server has them on.
  return (
    <AuthPageClient
      clientName={found?.name ?? null}
      clientHome={found?.redirect_uris[0] ? new URL(found.redirect_uris[0]).origin : null}
      emailCodeAvailable={isEmailConfigured()}
      passkeysAvailable={await arePasskeysEnabled()}
    />
  );
}
