'use client';

import Image from 'next/image';
import DefaultAvatar from '@/components/ui/DefaultAvatar';
import { cn } from '@/lib/utils';

interface Props {
  avatarUrl?: string | null;
  displayName: string;
  isGroupContext: boolean;
  className?: string;
  onOpen: () => void;
}

/** Collapsed sidebar: the avatar expands the sidebar and opens the switcher. */
export function CollapsedSwitcher({
  avatarUrl,
  displayName,
  isGroupContext,
  className,
  onOpen,
}: Props) {
  return (
    <div className={cn('px-2 py-3 border-b border-subtle flex justify-center', className)}>
      <button
        onClick={onOpen}
        className="rounded-md p-1.5 transition-colors hover:bg-surface-overlay"
        aria-label={`Switch context — ${displayName}`}
        title={`Switch context — ${displayName}`}
      >
        <div className="relative">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={displayName}
              width={32}
              height={32}
              className="h-8 w-8 rounded-md object-cover"
              unoptimized={avatarUrl?.includes('supabase.co')}
            />
          ) : (
            <DefaultAvatar size={32} className="rounded-md" />
          )}
          {/* Context indicator dot */}
          <div
            className={cn(
              'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-sm border-2 border-surface-page',
              isGroupContext ? 'bg-surface-raised' : 'bg-status-positive'
            )}
          />
        </div>
      </button>
    </div>
  );
}
