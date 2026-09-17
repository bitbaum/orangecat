/**
 * Vote Buttons Component
 *
 * Buttons for casting votes on active proposals.
 *
 * Created: 2025-01-30
 * Last Modified: 2025-01-30
 * Last Modified Summary: Initial implementation
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { CheckCircle2, XCircle, Minus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { API_ROUTES } from '@/config/api-routes';
import { apiErrorMessage } from '@/lib/api/errorMessage';

interface VoteButtonsProps {
  proposalId: string;
  groupSlug: string;
  currentVote?: 'yes' | 'no' | 'abstain' | null;
  onVoteCast?: () => void;
  disabled?: boolean;
}

export function VoteButtons({
  proposalId,
  groupSlug,
  currentVote,
  onVoteCast,
  disabled = false,
}: VoteButtonsProps) {
  const [voting, setVoting] = useState(false);
  const [selectedVote, setSelectedVote] = useState<'yes' | 'no' | 'abstain' | null>(
    currentVote || null
  );

  const handleVote = async (vote: 'yes' | 'no' | 'abstain') => {
    if (voting || disabled) {
      return;
    }

    try {
      setVoting(true);
      setSelectedVote(vote);

      const response = await fetch(API_ROUTES.GROUPS.PROPOSAL_VOTE(groupSlug, proposalId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(apiErrorMessage(error, 'Failed to cast vote'));
      }

      toast.success(`Vote cast: ${vote === 'yes' ? 'Yes' : vote === 'no' ? 'No' : 'Abstain'}`);
      onVoteCast?.();
    } catch (error) {
      logger.error('Failed to cast vote:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to cast vote');
      setSelectedVote(currentVote || null);
    } finally {
      setVoting(false);
    }
  };

  const getButtonVariant = (
    vote: 'yes' | 'no' | 'abstain'
  ): 'primary' | 'secondary' | 'danger' | 'outline' => {
    if (selectedVote === vote) {
      return vote === 'yes' ? 'primary' : vote === 'no' ? 'danger' : 'secondary';
    }
    return 'outline';
  };

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <Button
        onClick={() => handleVote('yes')}
        disabled={voting || disabled}
        variant={getButtonVariant('yes')}
        className={`flex-1 ${selectedVote === 'yes' ? 'bg-status-positive hover:bg-status-positive/90' : ''}`}
      >
        {voting && selectedVote === 'yes' ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="mr-2 h-4 w-4" />
        )}
        Yes
        {selectedVote === 'yes' && !voting && ' ✓'}
      </Button>

      <Button
        onClick={() => handleVote('no')}
        disabled={voting || disabled}
        variant={getButtonVariant('no')}
        className={`flex-1 ${selectedVote === 'no' ? 'bg-status-negative hover:bg-status-negative/90' : ''}`}
      >
        {voting && selectedVote === 'no' ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <XCircle className="mr-2 h-4 w-4" />
        )}
        No
        {selectedVote === 'no' && !voting && ' ✓'}
      </Button>

      <Button
        onClick={() => handleVote('abstain')}
        disabled={voting || disabled}
        variant={getButtonVariant('abstain')}
        className={`flex-1 ${selectedVote === 'abstain' ? 'bg-surface-raised hover:bg-surface-overlay dark:bg-surface-raised dark:hover:bg-surface-raised/80' : ''}`}
      >
        {voting && selectedVote === 'abstain' ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Minus className="mr-2 h-4 w-4" />
        )}
        Abstain
        {selectedVote === 'abstain' && !voting && ' ✓'}
      </Button>
    </div>
  );
}
