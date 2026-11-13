/**
 * Proposal Detail Page
 *
 * Displays a single proposal with full details and voting functionality.
 *
 * Created: 2025-01-30
 * Last Modified: 2025-01-30
 * Last Modified Summary: Initial implementation
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProposalDetail } from '@/components/groups/proposals/ProposalDetail';
import { createServerClient } from '@/lib/supabase/server';
import { checkGroupPermission } from '@/services/groups/permissions';
import { getGroupBySlug } from '@/services/groups/queries/groups';

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
}

// Group governance is member-facing, not search content — never index proposals.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ProposalPage({ params }: PageProps) {
  const { slug, id } = await params;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get group — with the server client; the services' browser-client fallback
  // cannot run on the server and would make every group read as missing.
  const groupResult = await getGroupBySlug(slug, supabase);
  if (!groupResult.success || !groupResult.group) {
    notFound();
  }

  const group = groupResult.group;

  // Check permissions
  let canVote = false;
  let canActivate = false;

  if (user) {
    canVote = await checkGroupPermission(group.id, user.id, 'canVote', supabase);
    // Can activate if proposer or admin
    const canCreateProposal = await checkGroupPermission(
      group.id,
      user.id,
      'canCreateProposals',
      supabase
    );
    canActivate = canCreateProposal; // For now, same permission
  }

  return (
    <ProposalDetail
      proposalId={id}
      groupSlug={slug}
      groupId={group.id}
      canVote={canVote}
      canActivate={canActivate}
    />
  );
}
