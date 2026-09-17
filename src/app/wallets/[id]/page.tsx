import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { readPublicWallet } from '@/services/wallets/publicWalletRead';
import { WALLET_CATEGORIES, type WalletCategory } from '@/types/wallet';
import { ROUTES } from '@/config/routes';
import WalletPayPanel from '@/components/wallets/WalletPayPanel';

interface PageProps {
  params: Promise<{ id: string }>;
}

/** Category presentation, tolerant of a row whose category predates the list. */
function categoryOf(wallet: { category: string | null; category_icon: string | null }) {
  const known = WALLET_CATEGORIES[wallet.category as WalletCategory];
  return {
    label: known?.label ?? 'Wallet',
    icon: wallet.category_icon || known?.icon || '💰',
  };
}

async function ownerOf(profileId: string | null) {
  if (!profileId) {
    return null;
  }
  const supabase = await createServerClient();
  // `name`, not `display_name`. profiles has no display_name column and never
  // has — CD's schema-drift gate (which diffs deployed code against the LIVE
  // box schema) refused the deploy over exactly this, while CI passed because
  // check:schema-columns reads a committed snapshot instead.
  const { data } = await supabase
    .from('profiles')
    .select('username, name, avatar_url')
    .eq('id', profileId)
    .maybeSingle();
  return data as { username: string; name: string | null; avatar_url: string | null } | null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const wallet = await readPublicWallet(id);
  if (!wallet) {
    return { title: 'Wallet Not Found' };
  }
  const owner = await ownerOf(wallet.profile_id);
  const who = owner?.name || owner?.username;
  const title = wallet.label || categoryOf(wallet).label;

  return {
    title: who ? `${title} — ${who}` : title,
    description: who
      ? `Pay ${who} in Bitcoin, straight to their own wallet.`
      : 'Pay in Bitcoin, straight to the recipient’s own wallet.',
    // NOT indexed, deliberately. A wallet page is shareable by link — that is
    // the whole point — but a wallet is labelled by NEED ("Monthly Rent",
    // "medical costs"), and a search-indexed page per need publishes somebody's
    // circumstances to anyone who searches their name. The owner shares the
    // link; a crawler does not decide to. Flipping this is a product decision,
    // not a default.
    robots: { index: false, follow: false },
  };
}

/**
 * A wallet's own page.
 *
 * `publicBasePath: '/wallets'` has been declared for the wallet entity since the
 * registry was written; the route was simply never built, so a wallet was only
 * ever a card inside somebody's profile tab — nothing to link to, nothing to
 * send a supporter, no way to say "this one, for this".
 *
 * What it shows is EXACTLY what the profile Wallets tab already shows —
 * PUBLIC_WALLET_FIELDS and nothing else. That is deliberate: this page adds a
 * URL, not a disclosure. Balance, description and savings goals are all withheld
 * here even though the page has obvious room for them, because publishing them
 * would be a new disclosure of financial data and that is the owner's call to
 * make, not a side effect of adding a route.
 */
export default async function WalletPage({ params }: PageProps) {
  const { id } = await params;
  const wallet = await readPublicWallet(id);

  // Not found and not active are the same answer on purpose: a deactivated
  // wallet must not be distinguishable from one that never existed.
  if (!wallet) {
    notFound();
  }

  const owner = await ownerOf(wallet.profile_id);
  const { label: categoryLabel, icon } = categoryOf(wallet);

  return (
    <main className="mx-auto max-w-2xl px-4 sm:px-6 py-10">
      {owner?.username && (
        <Link
          href={ROUTES.PROFILES.VIEW(owner.username)}
          className="inline-flex items-center gap-1.5 text-sm text-fg-secondary hover:text-fg-primary transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          {owner.name || owner.username}
        </Link>
      )}

      <header className="mb-8">
        <div className="flex items-start gap-4">
          <span className="text-4xl leading-none" aria-hidden>
            {icon}
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-display text-fg-primary break-words">
              {wallet.label || categoryLabel}
            </h1>
            <p className="text-sm text-fg-secondary mt-1">
              {categoryLabel}
              {owner && (
                <>
                  {' · '}
                  <Link
                    href={ROUTES.PROFILES.VIEW(owner.username)}
                    className="hover:text-fg-primary transition-colors"
                  >
                    {owner.name || owner.username}
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>
      </header>

      <WalletPayPanel wallet={wallet} />

      <p className="text-xs text-fg-tertiary mt-6 text-center">
        Payments go straight to this person’s own wallet. OrangeCat never holds funds.
      </p>
    </main>
  );
}
