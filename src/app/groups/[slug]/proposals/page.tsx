/**
 * Proposals List Page
 *
 * Standalone route for viewing all proposals in a group.
 * Also accessible as a tab within GroupDetail.
 */

import { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase/server';
import { DATABASE_TABLES } from '@/config/database-tables';
import { notFound } from 'next/navigation';
import { getGroupBySlug } from '@/services/groups/queries/groups';
import { checkGroupPermission } from '@/services/groups/permissions';
import { ProposalsListPage } from './ProposalsListPage';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createServerClient();

  const { data: group } = await supabase
    .from(DATABASE_TABLES.GROUPS)
    .select('name')
    .eq('slug', slug)
    .single();

  const g = group as { name: string } | null;
  if (!g) {
    return { title: 'Proposals' };
  }

  return {
    title: `Proposals - ${g.name}`,
    description: `View and vote on proposals for ${g.name}`,
  };
}

export default async function ProposalsPage({ params }: PageProps) {
  const { slug } = await params;
  // The group services fall back to the browser client when given none, and
  // that client cannot run on the server: the group would read as missing.
  const supabase = await createServerClient();

  const groupResult = await getGroupBySlug(slug, supabase);
  if (!groupResult.success || !groupResult.group) {
    notFound();
  }

  const group = groupResult.group;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let canCreateProposal = false;
  if (user) {
    canCreateProposal = await checkGroupPermission(
      group.id,
      user.id,
      'canCreateProposals',
      supabase
    );
  }

  return (
    <ProposalsListPage
      groupId={group.id}
      groupSlug={slug}
      groupName={group.name}
      canCreateProposal={canCreateProposal}
    />
  );
}
