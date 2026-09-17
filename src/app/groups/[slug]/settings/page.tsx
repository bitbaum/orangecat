'use client';

/**
 * Group settings — founders/admins edit the group; founders can delete it.
 *
 * Fills the gap behind the group "Settings" button, which previously linked to
 * a non-existent route (404). Edits go through groupsService.updateGroup /
 * deleteGroup, both of which re-check permissions server-side
 * (manage_settings / delete_group) — the UI gating here is just affordance.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Trash2, ShieldAlert, Save } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useGroupDetail } from '@/components/groups/useGroupDetail';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import Loading from '@/components/Loading';
import { GOVERNANCE_PRESETS, type GovernancePreset } from '@/config/governance-presets';
import { STATUS } from '@/config/database-constants';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import groupsService from '@/services/groups';
import type { GroupVisibility } from '@/config/group-labels';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { apiErrorMessage } from '@/lib/api/errorMessage';

const VISIBILITY_OPTIONS: Array<{ value: GroupVisibility; label: string; hint: string }> = [
  { value: 'public', label: 'Public', hint: 'Anyone can find the group and see its content' },
  { value: 'members_only', label: 'Members only', hint: 'Listed, but only members see content' },
  { value: 'private', label: 'Private', hint: 'Hidden — invite-only' },
];

export default function GroupSettingsPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug as string;
  const router = useRouter();
  const { user } = useAuth();
  const { group, members, loading } = useGroupDetail(slug);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<GroupVisibility>('members_only');
  const [governance, setGovernance] = useState<GovernancePreset>('consensus');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Seed the form once the group loads.
  useEffect(() => {
    if (group) {
      setName(group.name ?? '');
      setDescription(group.description ?? '');
      setVisibility((group.visibility as GroupVisibility) ?? 'members_only');
      setGovernance((group.governance_preset as GovernancePreset) ?? 'consensus');
    }
  }, [group]);

  if (loading) {
    return <Loading fullScreen message="Loading group settings..." />;
  }

  const groupsBase = ENTITY_REGISTRY['group'].basePath;

  if (!group) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-xl font-semibold text-fg-primary">Group not found</h1>
        <Link href={groupsBase} className="mt-4 inline-block text-sm text-fg-primary underline">
          Back to groups
        </Link>
      </div>
    );
  }

  const currentRole = members.find(m => m.user_id === user?.id)?.role;
  const canManage =
    currentRole === STATUS.GROUP_MEMBERS.FOUNDER || currentRole === STATUS.GROUP_MEMBERS.ADMIN;
  const backHref = `${groupsBase}/${group.slug}`;

  // Permissions are governance-driven (SSOT: GOVERNANCE_PRESETS). Editing /
  // deleting may be directly allowed, require a member vote, or be denied
  // depending on the group's governance + the user's role. We reflect that
  // honestly instead of showing actions the server will reject.
  const groupGovernance = (group.governance_preset as GovernancePreset) ?? 'consensus';
  const rolePerms =
    currentRole === STATUS.GROUP_MEMBERS.FOUNDER ||
    currentRole === STATUS.GROUP_MEMBERS.ADMIN ||
    currentRole === STATUS.GROUP_MEMBERS.MEMBER
      ? GOVERNANCE_PRESETS[groupGovernance]?.roles?.[currentRole]
      : undefined;
  const canSaveDirectly = rolePerms?.manage_settings === 'allow';
  const deletePerm = rolePerms?.delete_group; // 'allow' | 'vote_required' | 'deny' | undefined
  const governanceName = GOVERNANCE_PRESETS[groupGovernance]?.name ?? groupGovernance;

  if (!canManage) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center p-6 text-center">
        <ShieldAlert className="mb-3 h-8 w-8 text-fg-secondary" />
        <h1 className="text-xl font-semibold text-fg-primary">You can’t manage this group</h1>
        <p className="mt-2 text-sm text-fg-secondary">
          Only the group’s founder or admins can change settings.
        </p>
        <Link href={backHref} className="mt-6 inline-block">
          <Button variant="outline">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to group
          </Button>
        </Link>
      </div>
    );
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Organization name is required');
      return;
    }
    try {
      setSaving(true);
      const result = await groupsService.updateGroup(group.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        visibility,
        governance_preset: governance,
      });
      if (result.success) {
        toast.success('Group settings saved');
        router.push(backHref);
      } else {
        toast.error(apiErrorMessage(result, 'Failed to save settings'));
      }
    } catch (error) {
      logger.error('Failed to save group settings', error, 'Groups');
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      const result = await groupsService.deleteGroup(group.id);
      if (result.success) {
        toast.success('Group deleted');
        router.push(groupsBase);
      } else {
        toast.error(apiErrorMessage(result, 'Failed to delete group'));
      }
    } catch (error) {
      logger.error('Failed to delete group', error, 'Groups');
      toast.error('Failed to delete group');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-fg-secondary hover:text-fg-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          {group.name}
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-fg-primary">Group settings</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
          <CardDescription>How your group appears to others.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <label className="text-sm font-medium text-fg-primary" htmlFor="group-name">
              Name
            </label>
            <Input
              id="group-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Organization name"
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-fg-primary" htmlFor="group-description">
              Description
            </label>
            <Textarea
              id="group-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What is this group about?"
              rows={3}
              className="mt-1"
            />
          </div>

          <div>
            <span className="text-sm font-medium text-fg-primary">Visibility</span>
            <div className="mt-2 space-y-2">
              {VISIBILITY_OPTIONS.map(opt => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                    visibility === opt.value
                      ? 'border-interactive/60 bg-surface-raised/40'
                      : 'border-subtle hover:bg-surface-raised/20'
                  }`}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value={opt.value}
                    checked={visibility === opt.value}
                    onChange={() => setVisibility(opt.value)}
                    className="mt-0.5"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-fg-primary">{opt.label}</span>
                    <span className="block text-xs text-fg-secondary">{opt.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-fg-primary" htmlFor="group-governance">
              Governance
            </label>
            <select
              id="group-governance"
              value={governance}
              onChange={e => setGovernance(e.target.value as GovernancePreset)}
              className="mt-1 w-full rounded-md border border-subtle bg-surface-base px-3 py-2 text-sm text-fg-primary"
            >
              {Object.values(GOVERNANCE_PRESETS).map(preset => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          </div>

          {!canSaveDirectly && (
            <p className="rounded-md border border-subtle bg-surface-raised/30 px-3 py-2 text-xs text-fg-secondary">
              Under {governanceName} governance, changing settings in your role requires a member
              vote — direct edits aren’t available here.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Link href={backHref}>
              <Button variant="ghost" disabled={saving}>
                Cancel
              </Button>
            </Link>
            <Button onClick={handleSave} disabled={saving || !canSaveDirectly}>
              {saving ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-4 w-4" />
              )}
              Save changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger zone — gated by the group's governance (delete_group permission). */}
      {deletePerm === 'vote_required' && (
        <Card className="border-status-negative/30">
          <CardHeader>
            <CardTitle className="text-base text-status-negative">Danger zone</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-fg-secondary">
              Under {governanceName} governance, deleting this group requires a member vote rather
              than a single decision.
            </p>
          </CardContent>
        </Card>
      )}

      {deletePerm === 'allow' && (
        <Card className="border-status-negative/30">
          <CardHeader>
            <CardTitle className="text-base text-status-negative">Danger zone</CardTitle>
            <CardDescription>
              Deleting a group is permanent and removes it for all members.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {confirmDelete ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-fg-secondary">
                  Permanently delete “{group.name}”?
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button variant="danger" size="sm" onClick={handleDelete} disabled={deleting}>
                  {deleting ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-1.5 h-4 w-4" />
                  )}
                  Delete group
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                className="text-status-negative hover:bg-status-negative/10"
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Delete group
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
