'use client';

/**
 * "Sign in with a passkey" — the browser's own prompt, nothing to type. On
 * success the client holds a session and the page's redirect effect sends the
 * person on (or back to the app that sent them), exactly as after a code.
 */
import { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import { browserSupportsPasskeys, signInWithPasskey } from '@/services/supabase/auth';

export function PasskeySignInButton({ disabled }: { disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  if (!browserSupportsPasskeys()) {
    return null;
  }
  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled || busy}
      onClick={async () => {
        setBusy(true);
        const { success, error } = await signInWithPasskey();
        if (!success) {
          const cancelled = /cancel|abort|not allowed/i.test(error?.message ?? '');
          toast.error(
            cancelled
              ? 'No passkey was used. Pick another way to sign in, or try again.'
              : 'Could not sign in with a passkey. Try another way in.'
          );
          setBusy(false);
        }
      }}
      className="mt-3 h-12 w-full"
    >
      {busy ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <>
          <KeyRound className="mr-2 h-4 w-4" />
          Sign in with a passkey
        </>
      )}
    </Button>
  );
}
