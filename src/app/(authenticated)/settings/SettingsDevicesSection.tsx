'use client';

import { useState } from 'react';
import { Loader2, MonitorSmartphone } from 'lucide-react';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import { supabase } from '@/lib/supabase/browser';
import { API_ROUTES } from '@/config/api-routes';
import { ROUTES } from '@/config/routes';
import { logger } from '@/utils/logger';

/** Sign out of every device and every app that signed in with this account. */
export function SettingsDevicesSection() {
  const [isSigningOut, setIsSigningOut] = useState(false);

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
    <div>
      <h3 className="mb-2 flex items-center text-lg font-semibold text-fg-primary">
        <MonitorSmartphone className="w-6 h-6 mr-2 text-fg-secondary" />
        Sign out everywhere
      </h3>
      <p className="mb-4 max-w-prose text-fg-secondary">
        Lost a device, or signed in somewhere you don&apos;t trust? Sign out of your account on
        every device, including this one — and out of every app that signed in with it (Solon, Loki
        and the rest). You&apos;ll need to sign in again.
      </p>
      <Button
        type="button"
        variant="outline"
        onClick={handleSignOutEverywhere}
        disabled={isSigningOut}
        className="min-h-11"
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
  );
}
