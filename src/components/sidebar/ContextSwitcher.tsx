'use client';

/**
 * Context Switcher
 *
 * Dropdown in the sidebar header that allows switching between
 * individual and group navigation contexts.
 *
 * - Shows current context (user avatar or group avatar)
 * - Lists user's groups for quick switching
 * - Links to group creation
 *
 * Created: 2026-02-25
 */

import { useId } from 'react';
import { useRouter } from 'next/navigation';
import { useDismissableMenu } from '@/hooks/useDismissableMenu';
import Image from 'next/image';
import Link from 'next/link';
import { publicProfilePath } from '@/config/public-profile-path';
import { ChevronDown, User, Users, Plus } from 'lucide-react';
import { useNavigationContext } from '@/hooks/useNavigationContext';
import type { GroupContextInfo } from '@/hooks/useNavigationContext';
import { NWCStatusBadge } from '@/components/nostr/NWCStatusBadge';
import DefaultAvatar from '@/components/ui/DefaultAvatar';
import type { Profile } from '@/types/database';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';
import { CollapsedSwitcher } from './CollapsedSwitcher';

interface ContextSwitcherProps {
  profile: Profile;
  isExpanded: boolean;
  /** Expands the sidebar — invoked when the collapsed-mode avatar is clicked */
  onExpand?: () => void;
  className?: string;
}

export function ContextSwitcher({
  profile,
  isExpanded,
  onExpand,
  className,
}: ContextSwitcherProps) {
  const router = useRouter();
  const { context, userGroups, loadingGroups, switchToIndividual, switchToGroup, isGroupContext } =
    useNavigationContext();

  const {
    isOpen,
    setIsOpen,
    rootRef: dropdownRef,
    triggerRef,
    onBlur: closeOnFocusLeave,
  } = useDismissableMenu();
  const panelId = useId();

  const handleSwitchToIndividual = () => {
    switchToIndividual();
    setIsOpen(false);
    router.push(ROUTES.DASHBOARD.HOME);
  };

  const handleSwitchToGroup = (group: GroupContextInfo) => {
    switchToGroup(group);
    setIsOpen(false);
    router.push(ROUTES.GROUPS.VIEW(group.slug));
  };

  const displayName = isGroupContext
    ? context.group?.name || 'Group'
    : profile.name || profile.username || 'You';

  const selfHref =
    isGroupContext && context.group?.slug
      ? ROUTES.GROUPS.VIEW(context.group.slug)
      : profile.username
        ? publicProfilePath(profile.username)
        : '/profile/';

  const avatarUrl = isGroupContext ? context.group?.avatar_url : profile.avatar_url;

  // Only show @username when it differs from the display name.
  const showSecondaryHandle =
    !isGroupContext &&
    !!profile.username &&
    profile.username.toLowerCase() !== (profile.name || '').toLowerCase();

  // Collapsed mode: the avatar expands the sidebar and opens the switcher —
  // same action it triggers when expanded, one click instead of a dead pixel
  if (!isExpanded) {
    return (
      <CollapsedSwitcher
        avatarUrl={avatarUrl}
        displayName={displayName}
        isGroupContext={isGroupContext}
        className={className}
        onOpen={() => {
          setIsOpen(true);
          onExpand?.();
        }}
      />
    );
  }

  return (
    <div
      ref={dropdownRef}
      className={cn('relative px-2 py-3 border-b border-subtle', className)}
      onBlur={closeOnFocusLeave}
    >
      {/* Trigger. The avatar + name open what people expect them to: your own
          public profile (or the group's page). The chevron alone opens the
          context switcher — before, the whole row only toggled the menu and
          there was no way from here to see your profile. */}
      <div className="flex w-full items-center gap-1 rounded-md">
        <Link
          href={selfHref}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-md p-2 transition-colors hover:bg-surface-overlay"
          aria-label={isGroupContext ? `Open ${displayName}` : 'View your profile'}
        >
          <div className="relative flex-shrink-0">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={displayName}
                width={40}
                height={40}
                className="h-10 w-10 rounded-md object-cover"
                unoptimized={avatarUrl?.includes('supabase.co')}
              />
            ) : isGroupContext ? (
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-surface-raised">
                <Users className="w-5 h-5 text-fg-primary" />
              </div>
            ) : (
              <DefaultAvatar size={40} className="rounded-md" />
            )}
            <div
              className={cn(
                'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-sm border-2 border-surface-page',
                isGroupContext ? 'bg-surface-raised' : 'bg-status-positive'
              )}
            />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-fg-primary truncate">{displayName}</p>
              <NWCStatusBadge />
            </div>
            {(isGroupContext || showSecondaryHandle) && (
              <p className="text-xs text-fg-secondary truncate">
                {isGroupContext ? 'Group' : `@${profile.username}`}
              </p>
            )}
          </div>
        </Link>
        <button
          type="button"
          ref={triggerRef}
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Switch context"
          aria-expanded={isOpen}
          aria-controls={panelId}
          className="flex min-h-11 min-w-11 flex-shrink-0 items-center justify-center rounded-md transition-colors hover:bg-surface-overlay"
        >
          <ChevronDown
            className={cn('w-4 h-4 text-fg-tertiary transition-transform', isOpen && 'rotate-180')}
          />
        </button>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          id={panelId}
          className="absolute left-2 right-2 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-md border border-subtle bg-surface-modal py-1 shadow-sm"
        >
          {profile.username && (
            <Link
              href={publicProfilePath(profile.username)}
              onClick={() => setIsOpen(false)}
              className="w-full flex min-h-11 items-center gap-3 px-3 py-2 text-left hover:bg-surface-overlay transition-colors"
            >
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-surface-raised">
                <User className="w-4 h-4 text-fg-secondary" />
              </div>
              <p className="text-sm text-fg-primary">View my profile</p>
            </Link>
          )}
          <div className="border-t border-subtle my-1" />
          {/* Individual context option */}
          <button
            onClick={handleSwitchToIndividual}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-surface-overlay transition-colors',
              !isGroupContext && 'bg-surface-raised'
            )}
          >
            {/* Your own row showed a generic person glyph while every group
                below it showed its real picture — the one row a person can
                identify at a glance was the one rendered anonymously. */}
            <div className="flex-shrink-0">
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={profile.name || profile.username || 'You'}
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-md object-cover"
                  unoptimized={profile.avatar_url.includes('supabase.co')}
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-raised">
                  <User className="w-4 h-4 text-fg-primary" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg-primary truncate">
                {profile.name || profile.username || 'You'}
              </p>
              <p className="text-xs text-fg-secondary">Personal</p>
            </div>
            {!isGroupContext && <div className="h-2 w-2 flex-shrink-0 rounded-sm bg-fg-primary" />}
          </button>

          {/* Groups section */}
          {(userGroups.length > 0 || loadingGroups) && (
            <>
              <div className="border-t border-subtle my-1" />
              <div className="px-3 py-1.5">
                <p className="text-xs font-medium text-fg-tertiary uppercase tracking-wider">
                  Groups
                </p>
              </div>
            </>
          )}

          {loadingGroups ? (
            <div className="px-3 py-2 text-xs text-fg-tertiary">Loading groups...</div>
          ) : (
            userGroups.map(group => (
              <button
                key={group.id}
                onClick={() => handleSwitchToGroup(group)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-surface-overlay transition-colors',
                  isGroupContext && context.group?.id === group.id && 'bg-surface-raised'
                )}
              >
                <div className="flex-shrink-0">
                  {group.avatar_url ? (
                    <Image
                      src={group.avatar_url}
                      alt={group.name}
                      width={32}
                      height={32}
                      className="rounded-md object-cover"
                      unoptimized={group.avatar_url?.includes('supabase.co')}
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-raised">
                      <Users className="w-4 h-4 text-fg-primary" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-fg-primary truncate">{group.name}</p>
                  <p className="text-xs text-fg-secondary truncate">{group.slug}</p>
                </div>
                {isGroupContext && context.group?.id === group.id && (
                  <div className="h-2 w-2 flex-shrink-0 rounded-sm bg-fg-primary" />
                )}
              </button>
            ))
          )}

          {/* Create group option */}
          <div className="border-t border-subtle my-1" />
          <button
            onClick={() => {
              setIsOpen(false);
              router.push(`${ROUTES.DASHBOARD.GROUPS}/create`);
            }}
            className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-surface-overlay transition-colors"
          >
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-surface-raised">
              <Plus className="w-4 h-4 text-fg-secondary" />
            </div>
            <p className="text-sm text-fg-secondary">Create a group</p>
          </button>
        </div>
      )}
    </div>
  );
}
