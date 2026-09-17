/**
 * Proposal Detail Component
 *
 * Full proposal view with voting functionality.
 *
 * Created: 2025-01-30
 * Last Modified: 2025-01-30
 * Last Modified Summary: Initial implementation
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Loader2, Clock, User } from 'lucide-react';
import { VotingProgress } from './VotingProgress';
import { VoteButtons } from './VoteButtons';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { API_ROUTES } from '@/config/api-routes';
import { formatRelativeTime } from '@/utils/dates';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { getStatusBadge, getTypeLabel } from './utils';
import { PROPOSAL_STATUSES, type ProposalStatus } from '@/config/proposal-constants';
import type { Proposal } from '@/services/groups/queries/proposals';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { apiErrorMessage } from '@/lib/api/errorMessage';

interface ProposalDetailProps {
  proposalId: string;
  groupSlug: string;
  groupId: string;
  canVote?: boolean;
  canActivate?: boolean;
}

export function ProposalDetail({
  proposalId,
  groupSlug,
  groupId: _groupId,
  canVote = false,
  canActivate = false,
}: ProposalDetailProps) {
  const { user } = useAuth();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [userVote, setUserVote] = useState<'yes' | 'no' | 'abstain' | null>(null);
  const [activating, setActivating] = useState(false);
  // Monotonic load id — only the most recent load may write state.
  const loadIdRef = useRef(0);

  const loadUserVote = useCallback(async () => {
    if (!user) {
      return;
    }
    try {
      const response = await fetch(API_ROUTES.GROUPS.PROPOSAL_VOTES(groupSlug, proposalId));
      if (response.ok) {
        const data = await response.json();
        const votes = data.data?.votes || data.votes || [];
        const myVote = votes.find(
          (v: { voter_id: string; vote: string }) => v.voter_id === user.id
        );
        if (myVote) {
          setUserVote(myVote.vote);
        }
      }
    } catch (error) {
      // Silently fail - not critical
      logger.error('Failed to load user vote:', error);
    }
  }, [user, groupSlug, proposalId]);

  const loadProposal = useCallback(async () => {
    const myLoadId = ++loadIdRef.current;
    try {
      setLoading(true);
      const response = await fetch(API_ROUTES.GROUPS.PROPOSAL(groupSlug, proposalId));
      if (myLoadId !== loadIdRef.current) {
        return;
      }
      if (!response.ok) {
        throw new Error('Failed to load proposal');
      }

      const data = await response.json();
      if (myLoadId !== loadIdRef.current) {
        return;
      }
      if (data.success || data.data) {
        setProposal(data.data?.proposal || data.proposal || data.data);
        // Load user's vote if exists
        if (user) {
          loadUserVote();
        }
      } else {
        throw new Error(apiErrorMessage(data, 'Failed to load proposal'));
      }
    } catch (error) {
      if (myLoadId !== loadIdRef.current) {
        return;
      }
      logger.error('Failed to load proposal:', error);
      toast.error('Failed to load proposal');
    } finally {
      if (myLoadId === loadIdRef.current) {
        setLoading(false);
      }
    }
  }, [groupSlug, proposalId, user, loadUserVote]);

  useEffect(() => {
    loadProposal();
    return () => {
      // Bump id so any in-flight loads are ignored.
      // Deliberate write to the live ref — not stale-read.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      loadIdRef.current++;
    };
  }, [proposalId, loadProposal]);

  const handleActivate = async () => {
    try {
      setActivating(true);
      const response = await fetch(API_ROUTES.GROUPS.PROPOSAL_ACTIVATE(groupSlug, proposalId), {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(apiErrorMessage(error, 'Failed to activate proposal'));
      }

      toast.success('Proposal activated! Voting is now open.');
      loadProposal();
    } catch (error) {
      logger.error('Failed to activate proposal:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to activate proposal');
    } finally {
      setActivating(false);
    }
  };

  const handleVoteCast = () => {
    loadProposal();
    loadUserVote();
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

  if (!proposal) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-fg-secondary">Proposal not found</p>
          <Link href={`${ENTITY_REGISTRY['group'].publicBasePath}/${groupSlug}`}>
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Group
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href={`${ENTITY_REGISTRY['group'].publicBasePath}/${groupSlug}`}>
        <Button variant="outline" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Group
        </Button>
      </Link>

      {/* Proposal Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {getStatusBadge(proposal.status as ProposalStatus)}
                <Badge variant="outline">{getTypeLabel(proposal.proposal_type)}</Badge>
              </div>
              <CardTitle className="text-2xl">{proposal.title}</CardTitle>
              {proposal.description && (
                <CardDescription className="mt-2 text-base whitespace-pre-wrap">
                  {proposal.description}
                </CardDescription>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Proposal Metadata */}
          <div className="grid grid-cols-2 gap-4 text-sm text-fg-secondary">
            {proposal.proposer && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>
                  Proposed by{' '}
                  <span className="font-medium">{proposal.proposer.name || 'Unknown'}</span>
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Created {formatRelativeTime(proposal.created_at)}</span>
            </div>
            {proposal.voting_ends_at && proposal.status === PROPOSAL_STATUSES.ACTIVE && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-fg-primary" />
                <span>Voting ends {formatRelativeTime(proposal.voting_ends_at)}</span>
              </div>
            )}
          </div>

          {/* Activate Button (for draft proposals) */}
          {proposal.status === PROPOSAL_STATUSES.DRAFT && canActivate && (
            <div className="pt-4 border-t">
              <Button onClick={handleActivate} disabled={activating}>
                {activating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Activate Proposal
              </Button>
              <p className="text-sm text-fg-secondary mt-2">
                Activating will start the voting period. This cannot be undone.
              </p>
            </div>
          )}

          {/* Voting Section (for active proposals) */}
          {proposal.status === PROPOSAL_STATUSES.ACTIVE && canVote && (
            <div className="pt-4 border-t space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Cast Your Vote</h3>
                <VoteButtons
                  proposalId={proposalId}
                  groupSlug={groupSlug}
                  currentVote={userVote}
                  onVoteCast={handleVoteCast}
                />
              </div>
            </div>
          )}

          {/* Voting Results */}
          {proposal.voting_results && (
            <div className="pt-4 border-t">
              <VotingProgress
                votingResults={proposal.voting_results}
                threshold={proposal.voting_threshold || 50}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
