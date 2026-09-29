'use client';

import { useEffect, useState } from 'react';
import { Shield, Link2, Loader2, MonitorSmartphone, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { MFAStatus } from '@/components/auth/MFASetup';
import { PasskeysCard } from '@/components/auth/PasskeysCard';
import { SignInMethodsCard } from '@/components/auth/SignInMethodsCard';
import { NostrConnectionCard } from '@/components/nostr/NostrConnectionCard';
import Button from '@/components/ui/Button';
import { supabase } from '@/lib/supabase/browser';
import { API_ROUTES } from '@/config/api-routes';
import { ROUTES } from '@/config/routes';
import { logger } from '@/utils/logger';

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
  const [isSigningOut, setIsSigningOut] = useState(false);
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

  // Two revocations, in this order: first the OAuth refresh tokens every
  // connected app (Solon, Loki, Heidi, outside sites) holds for this person —
  // that needs the session, so it goes before the session is gone — then every
  // OrangeCat session (scope: 'global'). Other devices are signed out as their
  // access tokens expire (~1h max).
  const handleSignOutEverywhere = async () => {
    setIsSigningOut(true);
    try {
      const apps = await fetch(API_ROUTES.AUTH.SIGNOUT_EVERYWHERE, {
        method: 'POST',
        credentials: 'include',
      });
      if (!apps.ok) {
        throw new Error(`Could not sign out of connected apps (${apps.status})`);
      }
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) {
        throw error;
      }
      window.location.assign(ROUTES.AUTH);
    } catch (err) {
      logger.error('Global sign-out failed', err, 'Settings');
      toast.error('Could not sign out everywhere. Try again.');
      setIsSigningOut(false);
    }
  };

  return (
    <>
      <div className="border-t border-subtle pt-10">
        <h3 className="text-lg font-semibold text-fg-primary mb-4 flex items-center">
          <Shield className="w-6 h-6 mr-2 text-fg-secondary" />
          Two-Factor Authentication
        </h3>
        <p className="text-fg-secondary mb-6">
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
        <div className="border-t border-subtle pt-10">
          <h3 className="text-lg font-semibold text-fg-primary mb-4 flex items-center">
            <KeyRound className="w-6 h-6 mr-2 text-fg-secondary" />
            Passkeys
          </h3>
          <p className="text-fg-secondary mb-6">
            Sign in with your face, fingerprint or device PIN instead of a password or a code. A
            passkey never leaves your device and cannot be phished. Add one per device you sign in
            from.
          </p>
          <div className="bg-surface-raised border border-default rounded-lg p-6 max-w-md">
            <PasskeysCard />
          </div>
        </div>
      )}

      <div className="border-t border-subtle pt-10">
        <h3 className="text-lg font-semibold text-fg-primary mb-4 flex items-center">
          <MonitorSmartphone className="w-6 h-6 mr-2 text-fg-secondary" />
          Sign out everywhere
        </h3>
        <p className="text-fg-secondary mb-6">
          Lost a device, or signed in somewhere you don&apos;t trust? Sign out of your account on
          every device, including this one — and out of every app that signed in with it (Solon,
          Loki and the rest). You&apos;ll need to sign in again.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={handleSignOutEverywhere}
          disabled={isSigningOut}
          className="px-6 py-2"
        >
          {isSigningOut ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing out…
            </>
          ) : (
            'Sign out all devices'
          )}
        </Button>
      </div>

      <div className="border-t border-subtle pt-10">
        <h3 className="text-lg font-semibold text-fg-primary mb-4 flex items-center">
          <Link2 className="w-6 h-6 mr-2 text-fg-secondary" />
          Ways to sign in
        </h3>
        <p className="text-fg-secondary mb-6">
          Every way into this account. Keep at least two: if you ever lose your inbox, a linked
          Google or GitHub account (or a passkey) still signs you in, and you change the email from
          inside.
        </p>
        <div className="bg-surface-raised border border-default rounded-lg p-6 max-w-md">
          <SignInMethodsCard />
        </div>
      </div>

      <div className="border-t border-subtle pt-10">
        <h3 className="text-lg font-semibold text-fg-primary mb-4 flex items-center">
          <Link2 className="w-6 h-6 mr-2 text-fg-secondary" />
          Connected Accounts
        </h3>
        <p className="text-fg-secondary mb-6">
          Connect external services for enhanced features like Lightning payments.
        </p>
        <div className="max-w-md">
          <NostrConnectionCard />
        </div>
      </div>
    </>
  );
}
