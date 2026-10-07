'use client';

/**
 * Accept or decline one group invitation. Every state has a way forward: a
 * pending invitation offers both answers, an answered or expired one says so
 * and links on, and a failed answer keeps both buttons with the reason.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { API_ROUTES } from '@/config/api-routes';
import { ROUTES } from '@/config/routes';
import { apiErrorMessage } from '@/lib/api/errorMessage';
import type { InvitationForInvitee } from '@/domain/groups/invitations.server';

type Answer = 'accept' | 'decline';

export function InvitationAnswer({ invitation }: { invitation: InvitationForInvitee }) {
  const router = useRouter();
  const [pending, setPending] = useState<Answer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);

  const group = invitation.group!;
  const expired = new Date(invitation.expires_at) < new Date();
  const open = invitation.status === 'pending' && !expired && !declined;

  const answer = async (action: Answer) => {
    setPending(action);
    setError(null);
    try {
      const res = await fetch(API_ROUTES.INVITATION(invitation.id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(apiErrorMessage(body, 'That did not go through. Try again.'));
        return;
      }
      if (action === 'accept') {
        toast.success(`You joined ${group.name}`);
        router.push(ROUTES.GROUPS.VIEW(body?.data?.group_slug || group.slug));
      } else {
        setDeclined(true);
      }
    } catch {
      setError('Could not reach OrangeCat. Check your connection and try again.');
    } finally {
      setPending(null);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <div className="flex items-start gap-3">
          <div className="oc-icon-tile h-10 w-10 shrink-0">
            <Users className="h-5 w-5 text-fg-secondary" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-fg-primary">
              {invitation.inviter?.name ?? 'Someone'} invited you to join {group.name}
            </h1>
            <p className="text-sm text-fg-secondary">
              As {invitation.role === 'admin' ? 'an admin' : 'a member'}
            </p>
          </div>
        </div>

        {group.description && (
          <p className="text-sm text-fg-secondary wrap-anywhere">{group.description}</p>
        )}
        {invitation.message && (
          <blockquote className="border-l-2 border-default pl-3 text-sm text-fg-primary wrap-anywhere">
            {invitation.message}
          </blockquote>
        )}

        {open ? (
          <>
            {error && <p className="text-sm text-status-negative">{error}</p>}
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                onClick={() => answer('accept')}
                disabled={pending !== null}
                className="min-h-11 flex-1"
              >
                <Check className="mr-2 h-4 w-4" aria-hidden="true" />
                {pending === 'accept' ? 'Joining…' : 'Join the group'}
              </Button>
              <Button
                onClick={() => answer('decline')}
                disabled={pending !== null}
                variant="outline"
                className="min-h-11 flex-1"
              >
                <X className="mr-2 h-4 w-4" aria-hidden="true" />
                {pending === 'decline' ? 'Declining…' : 'Decline'}
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-fg-secondary">
              {declined || invitation.status === 'declined'
                ? 'You declined this invitation.'
                : invitation.status === 'accepted'
                  ? 'You already accepted — you are a member.'
                  : invitation.status === 'revoked'
                    ? 'This invitation was withdrawn.'
                    : 'This invitation has expired. Ask the person who invited you to send a new one.'}
            </p>
            <Button
              href={
                invitation.status === 'accepted'
                  ? ROUTES.GROUPS.VIEW(group.slug)
                  : ROUTES.DASHBOARD.HOME
              }
              variant="outline"
            >
              {invitation.status === 'accepted' ? `Open ${group.name}` : 'Back to dashboard'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
