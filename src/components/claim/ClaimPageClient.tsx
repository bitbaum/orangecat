'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { APP_NAME } from '@/config/brand';
import { ROUTES } from '@/config/routes';
import { API_ROUTES } from '@/config/api-routes';
import { publicProfilePath } from '@/config/public-profile-path';
import type { ProfileClaimPreview } from '@/domain/profileClaims/types';

interface ClaimPageClientProps {
  preview: ProfileClaimPreview;
}

function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

export default function ClaimPageClient({ preview }: ClaimPageClientProps) {
  const { isAuthenticated, hydrated } = useAuth();
  const router = useRouter();
  const [isClaiming, setIsClaiming] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [hasDeclined, setHasDeclined] = useState(preview.status === 'declined');

  const { draft, isExpired } = preview;
  const person = draft.profile;
  // The credential, not the row id — this is what the public routes address.
  const claimToken = preview.token;

  const handleClaim = async () => {
    setIsClaiming(true);
    try {
      const res = await fetch(API_ROUTES.PROFILE_CLAIMS.CLAIM(claimToken), { method: 'POST' });
      const body = await res.json();
      if (!res.ok || !body.success) {
        toast.error(body?.error?.message || 'Could not claim this profile. Please try again.');
        setIsClaiming(false);
        return;
      }
      toast.success(`Welcome, ${person.name} — it’s yours now.`);
      // Land on the page that was theirs all along, under the same address
      // (ADR-0005 D7): the slug became their handle where it was free.
      const username = body.data?.username as string | null;
      const pageSlug = body.data?.pageSlug as string | null;
      router.push(
        username
          ? publicProfilePath(username)
          : pageSlug
            ? publicProfilePath(pageSlug)
            : ROUTES.PROFILES.ME
      );
    } catch {
      toast.error('Could not claim this profile. Check your connection and try again.');
      setIsClaiming(false);
    }
  };

  // Declining needs no account. Making "no" cost a signup would make refusing
  // more expensive than accepting, which is not consent.
  const handleDecline = async () => {
    setIsDeclining(true);
    try {
      const res = await fetch(API_ROUTES.PROFILE_CLAIMS.DECLINE(claimToken), { method: 'POST' });
      const body = await res.json();
      if (!res.ok || !body.success) {
        toast.error(body?.error?.message || 'Could not decline this. Please try again.');
        setIsDeclining(false);
        return;
      }
      setHasDeclined(true);
      toast.success(
        'Declined. The page and everything on it were removed, and nobody can use this link now.'
      );
    } catch {
      toast.error('Could not decline this. Check your connection and try again.');
    } finally {
      setIsDeclining(false);
    }
  };

  const registerHref = `${ROUTES.AUTH_REGISTER}&from=${encodeURIComponent(ROUTES.CLAIM(claimToken))}`;
  const loginHref = `${ROUTES.AUTH_LOGIN}&from=${encodeURIComponent(ROUTES.CLAIM(claimToken))}`;

  return (
    <div className="min-h-[calc(100svh-4rem)] bg-surface-page">
      <div className="mx-auto max-w-xl px-4 py-16 sm:py-24">
        <p className="text-center text-xs font-medium uppercase tracking-caps text-fg-muted">
          A profile is waiting for you on {APP_NAME}
        </p>

        <Card variant="elevated" className="mt-6 overflow-hidden">
          <div className="relative h-24 bg-surface-raised">
            <div className="absolute -bottom-8 left-6 h-16 w-16 overflow-hidden rounded-full border-4 border-surface-base bg-surface-raised shadow-sm">
              {person.avatarUrl ? (
                // Draft avatars come from an arbitrary URL a member pastes in when
                // creating the claim — next/image requires an allowlisted remote
                // host, which an arbitrary press photo won't be. Plain <img> for
                // this one, untrusted-source case.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={person.avatarUrl}
                  alt={person.name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-heading text-2xl text-fg-secondary">
                  {initialOf(person.name)}
                </div>
              )}
            </div>
          </div>

          <CardContent className="pt-12">
            <h1 className="font-heading text-2xl font-semibold tracking-display text-fg-primary">
              {person.name}
            </h1>
            {person.bio && <p className="mt-2 text-sm leading-6 text-fg-secondary">{person.bio}</p>}

            {!!person.socialLinks?.length && (
              <div className="mt-4 flex flex-wrap gap-2">
                {person.socialLinks.map(link => (
                  <span
                    key={`${link.platform}-${link.value}`}
                    className="rounded-full border border-border-subtle bg-surface-page px-3 py-1 text-xs text-fg-secondary"
                  >
                    {link.label || link.platform}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-6 rounded-lg border border-border-subtle bg-surface-page p-4 text-sm text-fg-secondary">
              Someone put this together for {person.name.split(' ')[0]} on {APP_NAME}. Claim it to
              take it over — edit anything, add your own payment methods, and make it yours.
            </div>

            {hasDeclined ? (
              <div className="mt-6 rounded-lg border border-border-subtle bg-surface-page p-4 text-sm text-fg-secondary">
                You declined this. The page and everything on it were removed, and the link can’t be
                used any more.
              </div>
            ) : isExpired ? (
              <div className="mt-6 rounded-lg border border-status-warning/40 bg-status-warning-subtle p-4 text-sm text-fg-primary">
                This claim link has expired. Ask whoever sent it to you for a fresh one.
              </div>
            ) : !hydrated ? (
              <div className="mt-6 h-11 animate-pulse rounded-lg bg-surface-raised" />
            ) : isAuthenticated ? (
              <Button
                variant="accent"
                size="lg"
                className="mt-6 w-full"
                onClick={handleClaim}
                isLoading={isClaiming}
              >
                Take it over
              </Button>
            ) : (
              <div className="mt-6 space-y-2">
                <Button variant="accent" size="lg" className="w-full" href={registerHref}>
                  Create an account &amp; claim it
                </Button>
                <p className="text-center text-xs text-fg-muted">
                  Already have an account?{' '}
                  <a href={loginHref} className="font-medium text-fg-primary underline">
                    Log in to claim it
                  </a>
                </p>
              </div>
            )}

            {!hasDeclined && !isExpired && (
              <p className="mt-4 text-center text-xs text-fg-muted">
                Not you, or don’t want this?{' '}
                <button
                  type="button"
                  onClick={handleDecline}
                  disabled={isDeclining}
                  className="font-medium text-fg-secondary underline underline-offset-2 disabled:opacity-60"
                >
                  {isDeclining ? 'Declining…' : 'Decline this'}
                </button>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
