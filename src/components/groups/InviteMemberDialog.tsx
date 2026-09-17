/**
 * InviteMemberDialog — founders/admins search people and add them to a group.
 *
 * Reuses the platform profile search (GET /api/profiles?search=) and the
 * existing groupsService.addMember mutation. Completes group member management
 * alongside leave + promote/demote/remove.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Search, UserPlus, Loader2, Check } from 'lucide-react';
import { API_ROUTES } from '@/config/api-routes';
import groupsService from '@/services/groups';
import { getInitial } from '@/utils/string';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { apiErrorMessage } from '@/lib/api/errorMessage';

interface ProfileLite {
  id: string;
  username: string | null;
  name: string | null;
  avatar_url?: string | null;
}

interface InviteMemberDialogProps {
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** user_ids already in the group — shown as "Member", not invitable. */
  existingMemberIds: string[];
  onInvited?: () => void;
}

export function InviteMemberDialog({
  groupId,
  open,
  onOpenChange,
  existingMemberIds,
  onInvited,
}: InviteMemberDialogProps) {
  const [search, setSearch] = useState('');
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runSearch = useCallback(async (q: string) => {
    try {
      setLoading(true);
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;
      const url = q
        ? `${API_ROUTES.PROFILES.BASE}?limit=20&search=${encodeURIComponent(q)}`
        : `${API_ROUTES.PROFILES.BASE}?limit=20`;
      const res = await fetch(url, { credentials: 'same-origin', signal: controller.signal });
      if (!res.ok) {
        throw new Error('Failed to load people');
      }
      const data = await res.json();
      const arr = Array.isArray(data.data)
        ? data.data
        : Array.isArray(data.data?.data)
          ? data.data.data
          : [];
      setProfiles(arr);
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') {
        return;
      }
      logger.error('Invite member search failed', e, 'Groups');
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search while the dialog is open.
  useEffect(() => {
    if (!open) {
      return;
    }
    const t = setTimeout(() => void runSearch(search), 250);
    return () => clearTimeout(t);
  }, [search, open, runSearch]);

  // Reset when closed.
  useEffect(() => {
    if (!open) {
      setSearch('');
      setProfiles([]);
    }
  }, [open]);

  const handleInvite = async (p: ProfileLite) => {
    try {
      setInvitingId(p.id);
      const result = await groupsService.addMember(groupId, { user_id: p.id });
      if (result.success) {
        toast.success(`Invited ${p.name || p.username || 'member'}`);
        onInvited?.();
      } else {
        toast.error(apiErrorMessage(result, 'Failed to invite member'));
      }
    } catch (e) {
      logger.error('Failed to invite member', e, 'Groups');
      toast.error('Failed to invite member');
    } finally {
      setInvitingId(null);
    }
  };

  const existing = new Set(existingMemberIds);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a member</DialogTitle>
          <DialogDescription>
            Search by name or @username and add them to the group.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-secondary" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search people…"
              className="pl-9"
              autoFocus
              aria-label="Search people to invite"
            />
          </div>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-fg-secondary">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : profiles.length === 0 ? (
              <p className="py-8 text-center text-sm text-fg-secondary">
                {search ? 'No people found' : 'Type a name or username to search'}
              </p>
            ) : (
              profiles.map(p => {
                const isMember = existing.has(p.id);
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-lg p-2 hover:bg-surface-raised/40"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage
                          src={p.avatar_url || undefined}
                          alt={p.name || p.username || 'User'}
                        />
                        <AvatarFallback className="bg-surface-raised text-fg-secondary">
                          {getInitial(p.name || p.username)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-fg-primary">
                          {p.name || p.username || 'User'}
                        </div>
                        {p.username && (
                          <div className="truncate text-xs text-fg-secondary">@{p.username}</div>
                        )}
                      </div>
                    </div>
                    {isMember ? (
                      <span className="flex items-center gap-1 text-xs text-fg-secondary">
                        <Check className="h-4 w-4" /> Member
                      </span>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleInvite(p)}
                        disabled={invitingId === p.id}
                      >
                        {invitingId === p.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <UserPlus className="mr-1.5 h-4 w-4" /> Invite
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
