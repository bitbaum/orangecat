import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageHeading } from '@/components/layout/PageHeading';
import { PersonalFinances } from '@/components/finances/PersonalFinances';
import { MoneyRoutes } from '@/components/finances/MoneyRoutes';
import type { RouteWallet } from '@/components/finances/moneyRoutesFormat';
import { DATABASE_TABLES } from '@/config/database-tables';
import { FINANCES_PAGE } from '@/config/finances';
import { ROUTES } from '@/config/routes';
import { getPersonalFinances } from '@/domain/finances/service';
import { getRouteOverview } from '@/domain/money-routes/service';
import { WALLET_CATEGORIES, type WalletCategory } from '@/types/wallet';
import { createServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: FINANCES_PAGE.title, description: FINANCES_PAGE.lede };
export const dynamic = 'force-dynamic';

/** One person's money picture — what came in, what is owed, where it goes next, the civic split, the tax estimate. */
export default async function FinancesPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(ROUTES.AUTH);
  }
  const { data: actors } = await supabase
    .from(DATABASE_TABLES.ACTORS)
    .select('id')
    .eq('user_id', user.id);
  const actorIds = ((actors ?? []) as Array<{ id: string }>).map(a => a.id);
  const finances = await getPersonalFinances(supabase, user.id, actorIds);

  // The wallets a money rule may send to: the person's own, active ones.
  const { data: walletRows } = await supabase
    .from(DATABASE_TABLES.WALLETS)
    .select('id, label, category, category_icon')
    .eq('profile_id', user.id)
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  const wallets: RouteWallet[] = (
    (walletRows ?? []) as Array<{
      id: string;
      label: string;
      category: WalletCategory | null;
      category_icon: string | null;
    }>
  ).map(w => ({
    id: w.id,
    label: w.label,
    icon: w.category_icon ?? WALLET_CATEGORIES[w.category ?? 'general']?.icon ?? '💰',
  }));
  const routes = await getRouteOverview(
    supabase,
    user.id,
    wallets.map(w => w.id)
  );

  return (
    <div className="oc-page">
      <div className="oc-page-container oc-page-stack pb-20 sm:pb-8">
        <header>
          <PageHeading>{FINANCES_PAGE.title}</PageHeading>
          <p className="mt-1 max-w-2xl text-sm text-fg-secondary">{FINANCES_PAGE.lede}</p>
        </header>
        <PersonalFinances finances={finances} />
        <MoneyRoutes
          initialLines={routes.lines}
          initialNext={routes.next}
          wallets={wallets}
          currency={finances.currency}
        />
      </div>
    </div>
  );
}
