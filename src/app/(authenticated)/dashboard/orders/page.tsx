import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Package } from 'lucide-react';
import { PageHeading } from '@/components/layout/PageHeading';
import EmptyState from '@/components/ui/EmptyState';
import { OrderCard } from '@/components/orders/OrderCard';
import { ORDERS_PAGE } from '@/config/orders';
import { ROUTES } from '@/config/routes';
import { listMyOrders } from '@/domain/commerce/orders';
import { createServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: ORDERS_PAGE.title, description: ORDERS_PAGE.lede };
export const dynamic = 'force-dynamic';

/** Every paid order the person is a side of: what they sold, then what they bought. */
export default async function OrdersPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(ROUTES.AUTH);
  }
  const orders = await listMyOrders(supabase, user.id);
  const sold = orders.filter(o => o.role === 'seller');
  const bought = orders.filter(o => o.role === 'buyer');

  return (
    <div className="oc-page">
      <div className="oc-page-container oc-page-stack pb-20 sm:pb-8">
        <header>
          <PageHeading>{ORDERS_PAGE.title}</PageHeading>
          <p className="mt-1 max-w-2xl text-sm text-fg-secondary">{ORDERS_PAGE.lede}</p>
        </header>
        {orders.length === 0 ? (
          <EmptyState icon={Package} title="No orders yet" description={ORDERS_PAGE.empty} />
        ) : (
          <>
            {[
              { heading: ORDERS_PAGE.sold, list: sold },
              { heading: ORDERS_PAGE.bought, list: bought },
            ]
              .filter(group => group.list.length > 0)
              .map(group => (
                <section key={group.heading} aria-label={group.heading} className="space-y-4">
                  <h2 className="text-lg font-semibold text-fg-primary">{group.heading}</h2>
                  {group.list.map(order => (
                    <OrderCard key={order.id} order={order} />
                  ))}
                </section>
              ))}
            <p className="mb-0 text-sm text-fg-secondary">
              <Link
                href={ROUTES.DASHBOARD.DEALS}
                className="-my-3 inline-flex min-h-11 items-center underline underline-offset-2"
              >
                {ORDERS_PAGE.reviewsLink}
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
