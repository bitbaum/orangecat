/**
 * QuotaMeter
 *
 * Shows the user's daily Cat budget so they can see headroom before they
 * hit the cap, and a path forward when they're close to / past it.
 *
 * Tier-aware states:
 *   - byok    → "Your key" badge; cap doesn't apply
 *   - pro     → "Pro · N of limit … left" chip; same near-cap / capped CTA logic as free
 *   - free    → "N of limit free messages left today" chip, normal weight
 *   - warning → ≤2 remaining: chip + inline "Add your key →" link
 *   - capped  → 0 remaining: red chip + same link
 *
 * The chip must be self-explanatory (founder feedback): full sentence on ≥sm,
 * compact "N of M left" on mobile, complete explanation in the tooltip + sr text.
 *
 * The CTA points at /settings/ai (BYOK setup) because that's the only
 * real escape today — once /pricing has a real Pro checkout we swap it
 * over.
 */

import Link from 'next/link';
import { KeyRound, Sparkles } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { CAT_UPSELL } from '@/config/cat-plans';
import { cn } from '@/lib/utils';
import type { CatQuota } from '../hooks/useCatQuota';

interface QuotaMeterProps {
  quota: CatQuota | null;
  className?: string;
}

const NEAR_CAP_THRESHOLD = 2;

/**
 * Whether the chip has anything to say. "10 of 10 free messages left" on every
 * visit is chrome, not information: shown only near or at the cap, and for a
 * BYOK user (it names whose key is paying). /settings/usage has the full view.
 */
export function isQuotaWorthShowing(quota: CatQuota | null): boolean {
  if (!quota) {
    return false;
  }
  return quota.tier === 'byok' || quota.requestsRemaining <= NEAR_CAP_THRESHOLD;
}

export function QuotaMeter({ quota, className }: QuotaMeterProps) {
  if (!quota) {
    return null;
  }

  if (quota.tier === 'byok') {
    // Show the actual provider name when we know it — the freedom
    // architecture is most visible when the user sees "OpenAI" or
    // "Together" in their toolbar instead of a generic "Your key".
    const label = quota.activeByokProviderName ?? 'Your key';
    return (
      <Link
        href={ROUTES.SETTINGS_USAGE}
        className={cn(
          'inline-flex items-center gap-1 rounded-md border border-subtle bg-surface-raised px-2 py-1 text-xs text-fg-secondary hover:text-fg-primary',
          className
        )}
        title={`Cat is routing through your ${label} key — you pay them directly. Click for full usage.`}
      >
        <KeyRound className="h-3 w-3" aria-hidden="true" />
        {label}
      </Link>
    );
  }

  const { tier, dailyLimit, requestsRemaining } = quota;
  const isPro = tier === 'pro';
  const isCapped = requestsRemaining <= 0;
  const isNearCap = !isCapped && requestsRemaining <= NEAR_CAP_THRESHOLD;

  // Self-explanatory in full via tooltip + screen readers; the visible chip
  // stays compact on small screens and spells itself out on ≥sm.
  const noun = isPro ? 'Cat messages' : 'free messages';
  const explanation = isCapped
    ? `You've used all ${dailyLimit} ${noun} for today · ${CAT_UPSELL.byokShort}`
    : `${requestsRemaining} of ${dailyLimit} ${noun} left today · ${CAT_UPSELL.byokShort}`;

  // CAPPED: the user can't send anything, so the only useful control is the
  // escape. Render ONE link (not label + separate CTA) — two nowrap links side
  // by side overflowed the toolbar on phones and collided with the panel
  // toggle. Single chip, short label on mobile, never wider than its space.
  if (isCapped) {
    return (
      <Link
        href={ROUTES.SETTINGS_AI}
        className={cn(
          'inline-flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs',
          'border-status-negative/30 bg-status-negative-subtle text-status-negative',
          'hover:bg-status-negative/15',
          className
        )}
        title={`${explanation} — ${CAT_UPSELL.byokFull}`}
        aria-live="polite"
      >
        <KeyRound className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
        <span className="truncate">
          <span className="sm:hidden">{CAT_UPSELL.cappedLabelShort}</span>
          <span className="hidden sm:inline">{CAT_UPSELL.cappedLabel}</span>
        </span>
        <span className="hidden flex-shrink-0 font-medium underline decoration-dotted underline-offset-2 md:inline">
          {CAT_UPSELL.byokAction} →
        </span>
        <span className="sr-only"> {explanation}</span>
      </Link>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex min-w-0 items-center gap-2 rounded-md border px-2 py-1 text-xs',
        isNearCap && 'border-status-warning/30 bg-status-warning-subtle text-status-warning',
        !isNearCap && isPro && 'border-accent-warm/30 bg-accent-warm/10 text-fg-primary',
        !isNearCap && !isPro && 'border-subtle bg-surface-raised text-fg-secondary',
        className
      )}
      title={explanation}
    >
      {isPro && !isNearCap && (
        <Sparkles className="h-3 w-3 flex-shrink-0 text-accent-warm" aria-hidden="true" />
      )}
      <Link
        href={ROUTES.SETTINGS_USAGE}
        className="truncate whitespace-nowrap hover:underline"
        aria-live="polite"
        title="See your full usage — what counts, when it resets, and your plan"
      >
        {isPro && 'Pro · '}
        {requestsRemaining} of {dailyLimit}
        <span className="hidden sm:inline"> {noun}</span> left
        <span className="hidden sm:inline"> today</span>
        {/* Only the part the visible chip doesn't already say. It used to
            repeat the whole sentence, so a screen reader announced the count
            twice — and copying the page text produced it twice too. */}
        <span className="sr-only">
          {' '}
          {noun} — {CAT_UPSELL.byokShort}
        </span>
      </Link>
      {isNearCap && (
        <Link
          href={ROUTES.SETTINGS_AI}
          className="hidden flex-shrink-0 whitespace-nowrap font-medium underline decoration-dotted underline-offset-2 hover:no-underline sm:inline"
          title="Bring your own API key — unlimited messages, you pay your provider directly"
        >
          {CAT_UPSELL.byokAction} →
        </Link>
      )}
    </span>
  );
}
