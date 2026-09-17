'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { UserPlus, Link2, Loader2, Copy, Check, Ban, Send } from 'lucide-react';
import { toast } from 'sonner';
import EntityListShell from '@/components/entity/EntityListShell';
import EmptyState from '@/components/ui/EmptyState';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { ROUTES } from '@/config/routes';
import { API_ROUTES } from '@/config/api-routes';
import { logger } from '@/utils/logger';

interface ProfileClaimListItem {
  id: string;
  name: string;
  status: 'pending' | 'claimed' | 'revoked' | 'declined';
  suggestedUsername: string | null;
  claimUrl: string;
  createdAt: string;
  claimedAt: string | null;
  expiresAt: string;
}

const STATUS_LABEL: Record<ProfileClaimListItem['status'], string> = {
  pending: 'Waiting to be claimed',
  claimed: 'Claimed',
  revoked: 'Revoked',
  // The recipient said no. Distinct from `revoked`, which is the creator
  // pulling the link — collapsing them would hide a refusal.
  declined: 'Declined',
};

const STATUS_CLASS: Record<ProfileClaimListItem['status'], string> = {
  pending: 'bg-status-warning-subtle text-fg-primary',
  claimed: 'bg-status-positive-subtle text-fg-primary',
  revoked: 'bg-surface-raised text-fg-muted',
  declined: 'bg-surface-raised text-fg-muted',
};

function ClaimRow({
  claim,
  onRevoked,
}: {
  claim: ProfileClaimListItem;
  onRevoked: (id: string) => void;
}) {
  const { copied, copy } = useCopyToClipboard();
  const [isRevoking, setIsRevoking] = useState(false);
  const fullUrl =
    typeof window !== 'undefined' ? `${window.location.origin}${claim.claimUrl}` : claim.claimUrl;

  const handleRevoke = async () => {
    setIsRevoking(true);
    try {
      const res = await fetch(API_ROUTES.PROFILE_CLAIMS.BY_ID(claim.id), { method: 'DELETE' });
      const body = await res.json();
      if (!res.ok || !body.success) {
        toast.error(body?.error?.message || 'Could not revoke this link.');
        return;
      }
      toast.success('Link revoked.');
      onRevoked(claim.id);
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-fg-primary">{claim.name}</p>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[claim.status]}`}
            >
              {STATUS_LABEL[claim.status]}
            </span>
          </div>
          {claim.suggestedUsername && (
            <p className="mt-0.5 text-xs text-fg-muted">@{claim.suggestedUsername}</p>
          )}
        </div>

        {claim.status === 'pending' && (
          <div className="flex items-center gap-2">
            <Link href={ROUTES.DASHBOARD.PROFILE_CLAIMS_SHARE(claim.id)}>
              <Button variant="accent" size="sm">
                <Send className="mr-1.5 h-3.5 w-3.5" />
                Send
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={() => copy(fullUrl)}>
              {copied ? (
                <Check className="mr-1.5 h-3.5 w-3.5" />
              ) : (
                <Copy className="mr-1.5 h-3.5 w-3.5" />
              )}
              Copy link
            </Button>
            <Button variant="ghost" size="sm" onClick={handleRevoke} isLoading={isRevoking}>
              <Ban className="mr-1.5 h-3.5 w-3.5" />
              Revoke
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ProfileClaimsPage() {
  const [claims, setClaims] = useState<ProfileClaimListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(API_ROUTES.PROFILE_CLAIMS.BASE);
      const body = await res.json();
      if (body.success) {
        setClaims(body.data.claims);
      } else {
        toast.error(body?.error?.message || 'Could not load your claim links.');
      }
    } catch (error) {
      logger.error('Failed to load profile claims', error, 'ProfileClaims');
      toast.error('Could not load your claim links.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRevoked = (id: string) => {
    setClaims(prev => prev.map(c => (c.id === id ? { ...c, status: 'revoked' } : c)));
  };

  return (
    <EntityListShell
      title="Profiles you've drafted"
      description="Claim links you've created for people who aren't on OrangeCat yet."
      headerActions={
        <Button variant="accent" href={ROUTES.DASHBOARD.PROFILE_CLAIMS_NEW}>
          <UserPlus className="mr-1.5 h-4 w-4" />
          Draft a profile
        </Button>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-fg-tertiary" />
        </div>
      ) : claims.length === 0 ? (
        <EmptyState
          icon={Link2}
          title="No drafted profiles yet"
          description="Draft a profile for a friend who isn't on OrangeCat — they'll get a link to preview it and claim it as their own."
          action={
            <Button variant="accent" href={ROUTES.DASHBOARD.PROFILE_CLAIMS_NEW}>
              <UserPlus className="mr-1.5 h-4 w-4" />
              Draft a profile
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {claims.map(claim => (
            <ClaimRow key={claim.id} claim={claim} onRevoked={handleRevoked} />
          ))}
        </div>
      )}
    </EntityListShell>
  );
}
