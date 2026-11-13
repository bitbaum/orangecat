'use client';

import { useEffect, useState } from 'react';
import { Shield, Link2, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { MFAStatus } from '@/components/auth/MFASetup';
import { PasskeysCard } from '@/components/auth/PasskeysCard';
import { SignInMethodsCard } from '@/components/auth/SignInMethodsCard';
import { NostrConnectionCard } from '@/components/nostr/NostrConnectionCard';
import Button from '@/components/ui/Button';
import { API_ROUTES } from '@/config/api-routes';

interface Props {
  mfaStatusKey: number;
  onEnableMFA: () => void;
  onMFADisableComplete: () => void;
}

export function SettingsSecuritySection({
  mfaStatusKey,
  onEnableMFA,
  onMFADisableComplete,
}: Props) {
  const [showNostr, setShowNostr] = useState(false);
  // Shown only when the auth server has passkeys switched on (a public fact,
  // cached server-side); see docs/operations/passkeys.md.
  const [passkeysAvailable, setPasskeysAvailable] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch(API_ROUTES.AUTH.PASSKEYS_AVAILABLE)
      .then(res => (res.ok ? res.json() : null))
      .then((json: { data?: { available?: boolean } } | null) => {
        if (!cancelled) {
          setPasskeysAvailable(json?.data?.available === true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <div>
        <h3 className="mb-2 flex items-center text-lg font-semibold text-fg-primary">
          <Shield className="w-6 h-6 mr-2 text-fg-secondary" />
          Two-Factor Authentication
        </h3>
        <p className="mb-4 max-w-prose text-fg-secondary">
          Add an extra layer of security to your account by requiring a code from your authenticator
          app when signing in.
        </p>
        <div className="bg-surface-raised border border-default rounded-lg p-6 max-w-md">
          <MFAStatus
            key={mfaStatusKey}
            onEnableClick={onEnableMFA}
            onDisableComplete={() => {
              toast.success('Two-factor authentication has been disabled');
              onMFADisableComplete();
            }}
          />
          <div className="mt-4 pt-4 border-t border-default">
            <p className="text-xs text-fg-secondary">
              <strong className="font-medium text-fg-primary">
                Keep your authenticator backed up.
              </strong>{' '}
              OrangeCat has no recovery codes: if you lose the device and its backup, only support
              can restore access. Most authenticator apps offer an encrypted cloud backup — turn it
              on before you enable two-factor.
            </p>
          </div>
        </div>
      </div>

      {passkeysAvailable && (
        <div>
          <h3 className="mb-2 flex items-center text-lg font-semibold text-fg-primary">
            <KeyRound className="w-6 h-6 mr-2 text-fg-secondary" />
            Passkeys
          </h3>
          <p className="mb-4 max-w-prose text-fg-secondary">
            Sign in with your face, fingerprint or device PIN instead of a password or a code. A
            passkey never leaves your device and cannot be phished. Add one per device you sign in
            from.
          </p>
          <div className="bg-surface-raised border border-default rounded-lg p-6 max-w-md">
            <PasskeysCard />
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-2 flex items-center text-lg font-semibold text-fg-primary">
          <Link2 className="w-6 h-6 mr-2 text-fg-secondary" />
          Ways to sign in
        </h3>
        <p className="mb-4 max-w-prose text-fg-secondary">
          Every way into this account. Keep at least two: if you ever lose your inbox, a linked
          Google or GitHub account (or a passkey) still signs you in, and you change the email from
          inside.
        </p>
        <div className="bg-surface-raised border border-default rounded-lg p-6 max-w-md">
          <SignInMethodsCard />
        </div>
      </div>

      <div>
        <h3 className="mb-2 flex items-center text-lg font-semibold text-fg-primary">
          <Link2 className="mr-2 h-6 w-6 text-fg-secondary" />
          Nostr
        </h3>
        <p className="mb-4 max-w-prose text-fg-secondary">
          Link a Nostr key to sign posts and use Nostr Wallet Connect for Lightning payments.
        </p>
        {showNostr ? (
          <div className="max-w-md">
            <NostrConnectionCard />
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => setShowNostr(true)}
            aria-expanded={false}
          >
            Connect Nostr
          </Button>
        )}
      </div>
    </>
  );
}
