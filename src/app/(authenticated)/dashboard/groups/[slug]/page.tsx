import { GroupDetail } from '@/components/groups/GroupDetail';
import { createServerClient } from '@/lib/supabase/server';
import { resolveGroupBySlug } from '@/domain/groups/helpers.server';
import { resolveSellerReceiveInfo } from '@/domain/payments';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function DashboardGroupDetailPage({ params }: PageProps) {
  const { slug } = await params;
  // Same yes/no as the public group page (src/app/groups/[slug]/page.tsx).
  const group = await resolveGroupBySlug(await createServerClient(), slug);
  const canReceive = group ? (await resolveSellerReceiveInfo('group', group.id)) !== null : false;
  return <GroupDetail groupSlug={slug} canReceive={canReceive} />;
}
