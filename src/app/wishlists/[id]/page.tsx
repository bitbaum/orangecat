import { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase/server';
import { generateEntityMetadata } from '@/lib/seo/metadata';
import { DATABASE_TABLES } from '@/config/database-tables';
import PublicEntityDetailPage, {
  fetchEntityForMetadata,
} from '@/components/public/PublicEntityDetailPage';
import {
  buildWishlistDetailConfig,
  WISHLIST_ITEM_COLUMNS,
  type WishlistDetailItem,
} from '@/components/public/detail-configs/wishlist';
import { notFoundTitle } from '@/config/not-found';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const wishlist = await fetchEntityForMetadata('wishlist', id, 'title, description', {
    column: 'is_active',
    value: true,
  });
  if (!wishlist) {
    return {
      title: notFoundTitle('wishlist'),
      description: 'The wishlist you are looking for does not exist.',
    };
  }
  return generateEntityMetadata({
    type: 'wishlist',
    id,
    title: wishlist.title,
    description: wishlist.description,
  });
}

export default async function PublicWishlistPage({ params }: PageProps) {
  const { id } = await params;

  // Items live in a sibling table and are the page's main content — fetch them
  // here and hand them to the shared builder (SSOT with the owner dashboard
  // page) so the generic component still does the parent-entity fetch.
  const supabase = await createServerClient();
  const { data: itemsData } = await supabase
    .from(DATABASE_TABLES.WISHLIST_ITEMS)
    .select(WISHLIST_ITEM_COLUMNS)
    .eq('wishlist_id', id)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true });

  const items = (itemsData || []) as unknown as WishlistDetailItem[];

  return <PublicEntityDetailPage id={id} config={buildWishlistDetailConfig(items)} />;
}
