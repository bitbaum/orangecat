/**
 * Wishlist Item Detail Page
 *
 * Displays a wishlist item with its proof section.
 *
 * Created: 2026-01-07
 * Last Modified: 2026-01-07
 * Last Modified Summary: Created wishlist item detail page with proof section
 */

import { notFound, redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { WishlistItemProofSection } from '@/components/wishlist/WishlistItemProofSection';
import { FormattedAmount } from '@/components/ui/FormattedAmount';
import { DATABASE_TABLES } from '@/config/database-tables';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { authLoginPath } from '@/lib/navigation/safe-return-path';
import { getUserActorId } from '@/domain/actors';

interface PageProps {
  params: Promise<{ itemId: string }>;
}

// Actual queried shape — generated DB types are stale (missing is_fully_funded/is_fulfilled,
// and wishlists join uses actor_id not user_id in the live schema)
type WishlistItemRow = {
  id: string;
  wishlist_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  target_amount_btc: number;
  funded_amount_btc: number;
  is_fully_funded: boolean;
  is_fulfilled: boolean;
  wishlists: { id: string; title: string; actor_id: string } | null;
};

export default async function WishlistItemDetailPage({ params }: PageProps) {
  const { itemId } = await params;

  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect(authLoginPath('/dashboard/wishlists'));
  }

  const actorId = await getUserActorId(supabase, user.id);

  // Fetch wishlist item — cast result because DATABASE_TABLES.WISHLIST_ITEMS loses Supabase
  // type inference (same root cause as other DATABASE_TABLES.X usages in this codebase)
  const { data: itemData, error: itemError } = await supabase
    .from(DATABASE_TABLES.WISHLIST_ITEMS)
    .select(
      `
      id,
      title,
      description,
      image_url,
      target_amount_btc,
      funded_amount_btc,
      is_fully_funded,
      is_fulfilled,
      wishlist_id,
      wishlists!inner (
        id,
        title,
        actor_id
      )
    `
    )
    .eq('id', itemId)
    .single();

  const item = itemData as unknown as WishlistItemRow;

  if (itemError || !item) {
    notFound();
  }

  const wishlist = Array.isArray(item.wishlists) ? item.wishlists[0] : item.wishlists;
  const isOwner = Boolean(actorId && wishlist?.actor_id === actorId);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <Breadcrumb
          items={[
            {
              label: ENTITY_REGISTRY['wishlist'].namePlural,
              href: ENTITY_REGISTRY['wishlist'].basePath,
            },
            {
              label: wishlist?.title || 'Wishlist',
              href: wishlist?.id
                ? `${ENTITY_REGISTRY['wishlist'].basePath}/${wishlist.id}`
                : ENTITY_REGISTRY['wishlist'].basePath,
            },
            { label: item.title },
          ]}
          className="mb-4"
        />
        <h1 className="text-3xl font-bold mt-2">{item.title}</h1>
        {item.description && <p className="text-fg-secondary mt-2">{item.description}</p>}
      </div>

      {/* Funding Status */}
      <div className="bg-surface-base rounded-lg border border-default p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Funding Status</h2>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-fg-secondary">Target:</span>
            <FormattedAmount btc={item.target_amount_btc} className="font-medium" />
          </div>
          <div className="flex justify-between">
            <span className="text-fg-secondary">Funded:</span>
            <FormattedAmount btc={item.funded_amount_btc} className="font-medium" />
          </div>
          <div className="w-full bg-surface-raised rounded-full h-2 mt-4">
            <div
              className="bg-fg-primary h-2 rounded-full"
              style={{
                width: `${Math.min(100, (item.funded_amount_btc / item.target_amount_btc) * 100)}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Proof Section */}
      <WishlistItemProofSection itemId={itemId} canAddProof={isOwner || false} />
    </div>
  );
}
