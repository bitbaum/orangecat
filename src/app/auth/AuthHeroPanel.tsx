/**
 * Auth hero panel — the marketing column on the left of the sign-in
 * screen. Used to be a 🐾 emoji + hardcoded "Your AI Economic Agent"
 * strings; now derives identity from the brand SSOT and shows the
 * geometric BrandMarkIcon so the auth page rebrands automatically when
 * brand.ts changes.
 *
 * Also surfaces a "← Back to home" link because AppShell suppresses
 * the global header on auth routes — without this the user has no
 * non-browser escape from the form.
 *
 * Last updated: 2026-06-03
 */

import Link from 'next/link';
import { ArrowLeft, Clapperboard, Globe, Shield, TrendingUp } from 'lucide-react';
import { BrandMarkIcon } from '@/components/shell/BrandMarkIcon';
import { APP_NAME, APP_KICKER, APP_TAGLINE } from '@/config/brand';
import { ROUTES } from '@/config/routes';

const HIGHLIGHTS = [
  {
    icon: Clapperboard,
    label: 'Studio — make video, music, writing and artwork, then sell or finance it',
  },
  { icon: TrendingUp, label: 'Full economic spectrum — exchange, fund, lend, invest, govern' },
  { icon: Globe, label: 'Bitcoin & Lightning native — instant, near-zero-fee, non-custodial' },
  { icon: Shield, label: 'Pseudonymous by default — real identity opt-in, never required' },
] as const;

export function AuthHeroPanel() {
  return (
    <div className="relative hidden flex-1 flex-col justify-between border-r border-default bg-surface-base p-10 lg:flex lg:p-12">
      <Link
        href={ROUTES.HOME}
        className="inline-flex items-center gap-1.5 text-sm text-fg-secondary transition-colors hover:text-fg-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to home
      </Link>

      <div className="max-w-lg">
        <div className="mb-8 flex items-center gap-3">
          <div className="ui-brand-mark ui-brand-mark-default text-fg-primary">
            <BrandMarkIcon size={24} />
          </div>
          <div>
            <p className="ui-kicker">{APP_KICKER}</p>
            <span className="block text-lg font-medium tracking-tight text-fg-primary">
              {APP_NAME}
            </span>
          </div>
        </div>

        <h1 className="mb-5 text-4xl font-bold leading-tight tracking-tight text-fg-primary lg:text-5xl">
          {APP_TAGLINE}
        </h1>

        <p className="mb-10 text-lg leading-relaxed text-fg-secondary">
          Make it, fund it, sell it — and lend, invest and govern from the same place, with any
          identity, any counterparty, settled in Bitcoin. No gatekeepers.
        </p>

        <ul className="space-y-3">
          {HIGHLIGHTS.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-subtle bg-surface-raised/40">
                <Icon className="h-4 w-4 text-fg-primary" />
              </div>
              <span className="pt-1 text-sm text-fg-secondary">{label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div />
    </div>
  );
}
