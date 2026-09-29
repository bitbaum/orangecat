import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, KeyRound, LifeBuoy, Mail } from 'lucide-react';
import { OAUTH_PROVIDERS } from '@/app/auth/OAuthIcons';
import { ROUTES } from '@/config/routes';
import { arePasskeysEnabled } from '@/lib/auth/passkeys-availability';

export const metadata: Metadata = {
  title: "Can't get to your email?",
  description:
    'Every way back into an OrangeCat account when the inbox is out of reach: a linked Google or GitHub account, a passkey, or support.',
  robots: { index: false },
};

/**
 * /auth/cant-get-email — the recovery branch every email-bound flow points to.
 *
 * Until this page existed, "Forgot password?" and the reset form both ended in
 * "check your inbox", and a person without the inbox had nowhere to go. This
 * is the fleet rule: a gate records, it never blocks. Each option here is a
 * real way in that exists today; the last one is a person.
 */
export default async function CantGetEmailPage() {
  const passkeys = await arePasskeysEnabled();
  const providers = OAUTH_PROVIDERS.filter(p => p.id === 'google' || p.id === 'github');
  return (
    <div className="min-h-screen bg-surface-page px-4 py-12">
      <div className="mx-auto max-w-lg space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-fg-primary">Can&apos;t get to your email?</h1>
          <p className="mt-2 text-fg-secondary">
            Your account is not tied to the inbox. Any of these signs you in; once you are in,
            change the email under Settings → Account.
          </p>
        </div>

        <ol className="space-y-4">
          <li className="rounded-lg border border-default bg-surface-base p-5">
            <div className="flex items-center gap-2 font-medium text-fg-primary">
              <span className="flex gap-1">
                {providers.map(({ id, icon: Icon }) => (
                  <Icon key={id} className="h-4 w-4" />
                ))}
              </span>
              Sign in with a linked account
            </div>
            <p className="mt-1 text-sm text-fg-secondary">
              If you ever connected Google or GitHub to your OrangeCat account, their buttons on the
              sign-in page still work without your email.
            </p>
            <Link
              href={`${ROUTES.AUTH}?mode=login`}
              className="mt-3 inline-block text-sm font-medium text-fg-primary underline"
            >
              Go to sign in
            </Link>
          </li>

          {passkeys && (
            <li className="rounded-lg border border-default bg-surface-base p-5">
              <div className="flex items-center gap-2 font-medium text-fg-primary">
                <KeyRound className="h-4 w-4" /> Use a passkey
              </div>
              <p className="mt-1 text-sm text-fg-secondary">
                A passkey you created on a phone or computer signs you in with its unlock, and needs
                no email at all.
              </p>
              <Link
                href={`${ROUTES.AUTH}?mode=login`}
                className="mt-3 inline-block text-sm font-medium text-fg-primary underline"
              >
                Sign in with a passkey
              </Link>
            </li>
          )}

          <li className="rounded-lg border border-default bg-surface-base p-5">
            <div className="flex items-center gap-2 font-medium text-fg-primary">
              <Mail className="h-4 w-4" /> Get the inbox back first
            </div>
            <p className="mt-1 text-sm text-fg-secondary">
              Most email providers have their own recovery. If yours comes back, the six-digit code
              and the reset link both work again, on any device.
            </p>
          </li>

          <li className="rounded-lg border border-default bg-surface-base p-5">
            <div className="flex items-center gap-2 font-medium text-fg-primary">
              <LifeBuoy className="h-4 w-4" /> Ask a person
            </div>
            <p className="mt-1 text-sm text-fg-secondary">
              Nothing above applies? Support can verify you another way. Say which email the account
              used, roughly when you created it, and anything only you would know about it (a
              project you made, a payment you received).
            </p>
            <Link
              href={ROUTES.SUPPORT}
              className="mt-3 inline-block text-sm font-medium text-fg-primary underline"
            >
              Contact support
            </Link>
          </li>
        </ol>

        <p className="text-sm text-fg-secondary">
          Once you are back in: Settings → Security lists every way into your account. Keep at least
          two.
        </p>

        <Link
          href={`${ROUTES.AUTH}?mode=login`}
          className="inline-flex items-center text-sm text-fg-secondary hover:text-fg-primary"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to sign in
        </Link>
      </div>
    </div>
  );
}
