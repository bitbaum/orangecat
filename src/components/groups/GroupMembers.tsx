/**
 * Group Members Component
 *
 * Unified member management for groups using config-based types.
 *
 * Created: 2025-01-30
 * Last Modified: 2025-12-29
 * Last Modified Summary: Updated to use config-based types
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Users,
  UserPlus,
  Crown,
  Shield,
  ShieldOff,
  User,
  LogOut,
  MoreVertical,
  UserMinus,
} from 'lucide-react';
import { STATUS } from '@/config/database-constants';
import type { GroupMember, GroupRole } from '@/types/group';
import { getInitial } from '@/utils/string';
import { InviteMemberDialog } from './InviteMemberDialog';
import groupsService from '@/services/groups';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/utils/logger';
import { apiErrorMessage } from '@/lib/api/errorMessage';

// Extended member type with profile info (from queries/members.ts)
interface MemberWithProfile extends GroupMember {
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
}

interface GroupMembersProps {
  groupId: string;
  members: MemberWithProfile[];
  onUpdate?: () => void;
}

export function GroupMembers({ groupId, members, onUpdate }: GroupMembersProps) {
  const { user } = useAuth();
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const handleJoin = async () => {
    try {
      setJoining(true);
      const result = await groupsService.joinGroup(groupId);
      if (result.success) {
        toast.success('Successfully joined group!');
        onUpdate?.();
      } else {
        toast.error(apiErrorMessage(result, 'Failed to join group'));
      }
    } catch (error) {
      logger.error('Failed to join group:', error);
      toast.error('Failed to join group');
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    try {
      setLeaving(true);
      const result = await groupsService.leaveGroup(groupId);
      if (result.success) {
        toast.success('You left the group');
        setConfirmLeave(false);
        onUpdate?.();
      } else {
        toast.error(apiErrorMessage(result, 'Failed to leave group'));
      }
    } catch (error) {
      logger.error('Failed to leave group:', error);
      toast.error('Failed to leave group');
    } finally {
      setLeaving(false);
    }
  };

  const currentMember = members.find(m => m.user_id === user?.id);
  const isMember = !!currentMember;
  // Founders cannot leave (must transfer ownership or delete) — the service
  // rejects it, so we don't even offer the affordance.
  const canLeave = isMember && currentMember?.role !== STATUS.GROUP_MEMBERS.FOUNDER;
  // Founders/admins manage members. The service re-checks permissions, so this
  // only gates the affordance — the server is the source of truth.
  const canManage =
    currentMember?.role === STATUS.GROUP_MEMBERS.FOUNDER ||
    currentMember?.role === STATUS.GROUP_MEMBERS.ADMIN;

  const handleRoleChange = async (memberUserId: string, role: GroupRole) => {
    try {
      setBusyMemberId(memberUserId);
      const result = await groupsService.updateMember(groupId, memberUserId, { role });
      if (result.success) {
        toast.success(
          role === STATUS.GROUP_MEMBERS.ADMIN ? 'Member promoted to admin' : 'Admin set to member'
        );
        onUpdate?.();
      } else {
        toast.error(apiErrorMessage(result, 'Failed to update member'));
      }
    } catch (error) {
      logger.error('Failed to update member role:', error);
      toast.error('Failed to update member');
    } finally {
      setBusyMemberId(null);
    }
  };

  const handleRemove = async (memberUserId: string) => {
    try {
      setBusyMemberId(memberUserId);
      const result = await groupsService.removeMember(groupId, memberUserId);
      if (result.success) {
        toast.success('Member removed');
        onUpdate?.();
      } else {
        toast.error(apiErrorMessage(result, 'Failed to remove member'));
      }
    } catch (error) {
      logger.error('Failed to remove member:', error);
      toast.error('Failed to remove member');
    } finally {
      setBusyMemberId(null);
    }
  };

  const getRoleIcon = (role: GroupRole) => {
    switch (role) {
      case STATUS.GROUP_MEMBERS.FOUNDER:
        return <Crown className="h-4 w-4 text-status-warning" />;
      case STATUS.GROUP_MEMBERS.ADMIN:
        return <Shield className="h-4 w-4 text-fg-primary" />;
      default:
        return <User className="h-4 w-4 text-fg-secondary" />;
    }
  };

  const getRoleBadge = (role: GroupRole) => {
    switch (role) {
      case STATUS.GROUP_MEMBERS.FOUNDER:
        return <Badge variant="default">Founder</Badge>;
      case STATUS.GROUP_MEMBERS.ADMIN:
        return <Badge variant="secondary">Admin</Badge>;
      default:
        return <Badge variant="outline">Member</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Join Button (if not member) */}
      {!isMember && (
        <Card>
          <CardContent className="pt-6">
            <Button onClick={handleJoin} disabled={joining} className="w-full">
              <UserPlus className="h-4 w-4 mr-2" />
              {joining ? 'Joining...' : 'Join Group'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Members List */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Members ({members.length})
              </CardTitle>
              <CardDescription>People who are part of this group</CardDescription>
            </div>
            {canManage && (
              <Button variant="outline" size="sm" onClick={() => setInviteOpen(true)}>
                <UserPlus className="mr-1.5 h-4 w-4" />
                Invite
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="text-center py-8 text-fg-secondary">No members yet</div>
          ) : (
            <div className="space-y-3">
              {members.map(member => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-surface-raised/40 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar className="h-10 w-10 border-2 border-strong">
                      <AvatarImage
                        src={member.avatar_url || undefined}
                        alt={member.display_name || member.username || 'Member'}
                      />
                      <AvatarFallback className="bg-surface-raised text-fg-secondary">
                        {getInitial(member.display_name || member.username)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">
                          {member.display_name || member.username || 'Anonymous'}
                        </p>
                        {getRoleIcon(member.role)}
                      </div>
                      <p className="text-sm text-fg-secondary truncate">
                        @{member.username || 'user'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getRoleBadge(member.role)}
                    {canManage &&
                      member.user_id !== user?.id &&
                      member.role !== STATUS.GROUP_MEMBERS.FOUNDER && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              disabled={busyMemberId === member.user_id}
                              aria-label="Manage member"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {member.role === STATUS.GROUP_MEMBERS.ADMIN ? (
                              <DropdownMenuItem
                                onClick={() =>
                                  handleRoleChange(member.user_id, STATUS.GROUP_MEMBERS.MEMBER)
                                }
                              >
                                <ShieldOff className="h-4 w-4 mr-2" />
                                Make member
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() =>
                                  handleRoleChange(member.user_id, STATUS.GROUP_MEMBERS.ADMIN)
                                }
                              >
                                <Shield className="h-4 w-4 mr-2" />
                                Make admin
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleRemove(member.user_id)}
                              className="text-status-negative focus:text-status-negative"
                            >
                              <UserMinus className="h-4 w-4 mr-2" />
                              Remove from group
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Leave group (members only; founders must transfer/delete instead) */}
      {canLeave && (
        <div className="flex justify-end">
          {confirmLeave ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-fg-secondary">Leave this group?</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmLeave(false)}
                disabled={leaving}
              >
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={handleLeave} disabled={leaving}>
                {leaving ? 'Leaving…' : 'Leave'}
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmLeave(true)}
              className="text-fg-secondary hover:text-status-negative"
            >
              <LogOut className="h-4 w-4 mr-1.5" />
              Leave group
            </Button>
          )}
        </div>
      )}

      {canManage && (
        <InviteMemberDialog
          groupId={groupId}
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          existingMemberIds={members.map(m => m.user_id)}
          onInvited={() => onUpdate?.()}
        />
      )}
    </div>
  );
}
