'use client';

import Button from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { AuthDivider } from './AuthDivider';
import { OAUTH_PROVIDERS } from './OAuthIcons';
import { useEnabledOAuthProviders } from './oauthProviders';
import type { AuthMode, OAuthProvider } from './useAuthForm';

interface AuthSocialLoginProps {
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  loading: boolean;
  onOAuthSignIn: (provider: OAuthProvider) => void;
}

/**
 * The provider buttons, and — in forgot mode — the way back to signing in.
 * Switching between signing in and creating an account is the segmented
 * control under the title (AuthPageClient), not a link at the bottom.
 */
export function AuthSocialLogin({ mode, setMode, loading, onOAuthSignIn }: AuthSocialLoginProps) {
  // Only show providers the server actually has enabled — never a button that fails.
  const { enabled } = useEnabledOAuthProviders();
  const providers = OAUTH_PROVIDERS.filter(p => enabled.has(p.id));

  if (mode === 'forgot') {
    return (
      <div className="mt-6 text-center">
        <p className="mb-0 text-sm text-fg-secondary">Remember your password?</p>
        <button
          onClick={() => setMode('login')}
          disabled={loading}
          className="min-h-11 px-3 font-semibold text-fg-primary hover:text-fg-primary"
        >
          Sign in instead
        </button>
      </div>
    );
  }

  // Four across from `sm` leaves no room for a name, so only then is the
  // button an icon alone; two across always has room for the words.
  const iconOnlyFromSm = providers.length >= 3;
  const verb = mode === 'login' ? 'Sign in' : 'Sign up';

  // Only providers the server has enabled (useEnabledOAuthProviders): when
  // none are, the whole block is omitted rather than offering a dead button.
  if (providers.length === 0) {
    return null;
  }

  return (
    // max-[359px]:mt-3 — on the narrowest phones this row lands under the
    // fixed Loki feedback FAB (bottom-right); the tighter margin lifts it clear.
    <div className="mt-6 max-[359px]:mt-3">
      <AuthDivider label="Or continue with" />
      <div className={cn('mt-4 grid grid-cols-2 gap-3', iconOnlyFromSm && 'sm:grid-cols-4')}>
        {providers.map(({ id, name, icon: Icon }) => (
          <Button
            key={id}
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => onOAuthSignIn(id)}
            className="h-11 w-full border-default hover:border-strong hover:bg-surface-raised/60"
            // Named by its own words where they show; by a label only where
            // the button is an icon alone.
            aria-label={iconOnlyFromSm ? `${verb} with ${name}` : undefined}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span className={cn('ml-2 text-sm font-medium', iconOnlyFromSm && 'sm:hidden')}>
              {name}
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
}
