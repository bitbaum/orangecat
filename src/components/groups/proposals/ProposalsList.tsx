/**
 * Proposals List Component
 *
 * Displays a list of proposals for a group with filtering and pagination.
 *
 * Created: 2025-01-30
 * Last Modified: 2025-01-30
 * Last Modified Summary: Initial implementation
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileText, Plus, Loader2 } from 'lucide-react';
import { ProposalCard } from './ProposalCard';
import { CreateProposalDialog } from './CreateProposalDialog';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { useAuth } from '@/hooks/useAuth';
import { PROPOSAL_STATUSES, type ProposalStatus } from '@/config/proposal-constants';
import type { Proposal } from '@/services/groups/queries/proposals';
import { API_ROUTES } from '@/config/api-routes';
import { apiErrorMessage } from '@/lib/api/errorMessage';

type ProposalWithSlug = Proposal & { groupSlug: string };

interface ProposalsListProps {
  groupId: string;
  groupSlug: string;
  canCreateProposal?: boolean;
}

type ProposalStatusFilter = 'all' | ProposalStatus;

export function ProposalsList({
  groupId,
  groupSlug,
  canCreateProposal = false,
}: ProposalsListProps) {
  const { user } = useAuth();
  const [proposals, setProposals] = useState<ProposalWithSlug[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ProposalStatusFilter>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  // Monotonic load id — only the most recent load writes state.
  const loadIdRef = useRef(0);

  const loadProposals = useCallback(async () => {
    const myLoadId = ++loadIdRef.current;
    try {
      setLoading(true);
      setError(false);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      params.append('limit', '50');

      const response = await fetch(
        `${API_ROUTES.GROUPS.PROPOSALS(groupSlug)}?${params.toString()}`
      );
      if (myLoadId !== loadIdRef.current) {
        return;
      }
      if (!response.ok) {
        throw new Error('Failed to load proposals');
      }

      const data = await response.json();
      if (myLoadId !== loadIdRef.current) {
        return;
      }
      if (data.success) {
        setProposals(
          (data.data?.proposals || []).map(
            (p: Proposal): ProposalWithSlug => ({
              ...p,
              groupSlug,
            })
          )
        );
      } else {
        throw new Error(apiErrorMessage(data, 'Failed to load proposals'));
      }
    } catch (error) {
      if (myLoadId !== loadIdRef.current) {
        return;
      }
      logger.error('Failed to load proposals:', error);
      setError(true);
      toast.error('Failed to load proposals');
    } finally {
      if (myLoadId === loadIdRef.current) {
        setLoading(false);
      }
    }
  }, [groupSlug, statusFilter]);

  useEffect(() => {
    loadProposals();
    return () => {
      // Bump id so any in-flight loads can't setState after unmount/dep change.
      // Deliberate write to the live ref — not stale-read.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      loadIdRef.current++;
    };
  }, [groupId, statusFilter, loadProposals]);

  const handleProposalCreated = () => {
    loadProposals();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-fg-tertiary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <p className="text-sm text-fg-secondary">Couldn’t load proposals.</p>
          <Button variant="outline" size="sm" onClick={() => loadProposals()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Proposals</h3>
          <p className="text-sm text-fg-secondary">
            {proposals.length} proposal{proposals.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={value => setStatusFilter(value as ProposalStatusFilter)}
          >
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value={PROPOSAL_STATUSES.DRAFT}>Draft</SelectItem>
              <SelectItem value={PROPOSAL_STATUSES.ACTIVE}>Active</SelectItem>
              <SelectItem value={PROPOSAL_STATUSES.PASSED}>Passed</SelectItem>
              <SelectItem value={PROPOSAL_STATUSES.FAILED}>Failed</SelectItem>
              <SelectItem value={PROPOSAL_STATUSES.EXECUTED}>Executed</SelectItem>
              <SelectItem value={PROPOSAL_STATUSES.CANCELLED}>Cancelled</SelectItem>
            </SelectContent>
          </Select>
          {canCreateProposal && user && (
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Proposal
            </Button>
          )}
        </div>
      </div>

      {/* Proposals List */}
      {proposals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-fg-tertiary mx-auto mb-4" />
            <p className="text-fg-secondary mb-2">No proposals found</p>
            <p className="text-sm text-fg-tertiary">
              {statusFilter !== 'all'
                ? `No ${statusFilter} proposals`
                : 'Be the first to create a proposal'}
            </p>
            {canCreateProposal && user && (
              <Button onClick={() => setCreateDialogOpen(true)} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Create Proposal
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {proposals.map(proposal => (
            <ProposalCard key={proposal.id} proposal={proposal} />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      {user && (
        <CreateProposalDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          groupId={groupId}
          groupSlug={groupSlug}
          onProposalCreated={handleProposalCreated}
        />
      )}
    </div>
  );
}
