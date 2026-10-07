/**
 * Proof of Purchase Card Component
 *
 * Displays a single fulfillment proof with image, description,
 * and feedback (like/dislike) buttons.
 *
 * Created: 2026-01-06
 * Last Modified: 2026-01-06
 */

'use client';

import React from 'react';
import Image from 'next/image';
import { formatRelativeTime } from '@/utils/dates';
import { getInitial } from '@/utils/string';
import { Bitcoin, ExternalLink, Trash2, MoreVertical } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FeedbackButtons } from './FeedbackButtons';
import { PROOF_TYPE_META, type ProofOfPurchaseCardProps } from './types';
import { cn } from '@/lib/utils';
import { explorerTxUrl } from '@/lib/bitcoin/explorer';

export function ProofOfPurchaseCard({
  proof,
  onLike,
  onDislike,
  isOwner = false,
  onDelete,
  isLoading = false,
}: ProofOfPurchaseCardProps) {
  const proofMeta = PROOF_TYPE_META[proof.proof_type];
  const ProofIcon = proofMeta.icon;
  const timeAgo = formatRelativeTime(proof.created_at);

  return (
    <Card className={cn('p-4', isLoading && 'opacity-50 pointer-events-none')}>
      {/* Header with user info and actions */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={proof.user?.avatar_url} />
            <AvatarFallback>{getInitial(proof.user?.username)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">{proof.user?.username || 'Anonymous'}</p>
            <p className="text-xs text-fg-secondary">{timeAgo}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="flex items-center gap-1">
            <ProofIcon className="h-3 w-3" />
            <span className="text-xs">{proofMeta.label}</span>
          </Badge>

          {isOwner && onDelete && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-11 w-11 p-0" aria-label="Options">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-status-negative focus:text-status-negative"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Proof
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Proof Image */}
      {proof.image_url && (
        <div className="relative w-full aspect-video mb-3 rounded-lg overflow-hidden bg-surface-raised">
          <Image
            src={proof.image_url}
            alt="Proof of purchase"
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 500px"
          />
        </div>
      )}

      {/* Description */}
      <p className="text-sm text-fg-primary mb-3">{proof.description}</p>

      {/* Transaction ID */}
      {proof.transaction_id && (
        <div className="flex items-center gap-2 p-2 bg-surface-raised rounded-md mb-3">
          <Bitcoin className="h-4 w-4 text-bitcoin-orange" />
          <code className="text-xs font-mono flex-1 truncate">{proof.transaction_id}</code>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            aria-label="View transaction on a block explorer"
            onClick={() => {
              if (proof.transaction_id) {
                window.open(explorerTxUrl(proof.transaction_id), '_blank', 'noopener');
              }
            }}
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Feedback Buttons */}
      <div className="pt-3 border-t">
        <FeedbackButtons
          proofId={proof.id}
          wishlistItemId={proof.wishlist_item_id}
          likes={proof.feedback_summary?.likes || 0}
          dislikes={proof.feedback_summary?.dislikes || 0}
          userFeedback={proof.feedback_summary?.user_feedback}
          onLike={onLike}
          onDislike={onDislike}
          size="sm"
        />
      </div>
    </Card>
  );
}
