import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Handshake } from 'lucide-react';
import { PageHeading } from '@/components/layout/PageHeading';
import EmptyState from '@/components/ui/EmptyState';
import { DealCard } from '@/components/deals/DealCard';
import { DEALS_PAGE } from '@/config/reputation';
import { ROUTES } from '@/config/routes';
import { getUserActorIds } from '@/domain/actors';
import { listMyDeals } from '@/domain/reputation/service';
import { createServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: DEALS_PAGE.title, description: DEALS_PAGE.lede };
export const dynamic = 'force-dynamic';

/** Every deal the person was part of, and reviewing the other side (ADR-0010). */
export default async function DealsPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(ROUTES.AUTH);
  }
  const deals = await listMyDeals(supabase, await getUserActorIds(supabase, user.id));

  return (
    <div className="oc-page">
      <div className="oc-page-container oc-page-stack pb-20 sm:pb-8">
        <header>
          <PageHeading>{DEALS_PAGE.title}</PageHeading>
          <p className="mt-1 max-w-2xl text-sm text-fg-secondary">{DEALS_PAGE.lede}</p>
        </header>
        {deals.length === 0 ? (
          <EmptyState icon={Handshake} title="No deals yet" description={DEALS_PAGE.empty} />
        ) : (
          <div className="space-y-4">
            {deals.map(deal => (
              <DealCard key={deal.id} deal={deal} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
