'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HeaderIconButton } from '@/components/layout/HeaderIconButton';
import {
  CREATE_CATEGORY_LABELS,
  CREATE_OPTIONS,
  CREATE_PAGE,
  groupCreateOptions,
} from '@/config/create-options';
import { ROUTES } from '@/config/routes';
import { CreateOptionRowContent } from '@/components/create/CreateOptionRow';
import { VoiceCreate } from '@/components/create/VoiceCreate';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export function HeaderCreateButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <HeaderIconButton
          icon={Plus}
          label="Create new"
          variant="inverse"
          active={isOpen}
          iconClassName={cn('transition-transform duration-200', isOpen && 'rotate-45')}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={12}
        collisionPadding={16}
        className="w-80 max-w-[calc(100vw-2rem)] max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto p-2"
        aria-label="Create new"
      >
        <DropdownMenuLabel>Create new</DropdownMenuLabel>
        <VoiceCreate onNavigate={() => setIsOpen(false)} />
        {groupCreateOptions(CREATE_OPTIONS).map(group => (
          <div key={group.category}>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-fg-secondary">
              {CREATE_CATEGORY_LABELS[group.category]}
            </DropdownMenuLabel>
            {group.items.map(option => (
              <DropdownMenuItem key={option.href} asChild className="min-h-11 gap-3 px-3 py-2.5">
                <Link href={option.href}>
                  <CreateOptionRowContent option={option} />
                </Link>
              </DropdownMenuItem>
            ))}
          </div>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="min-h-11 px-3 text-sm text-fg-secondary">
          <Link href={ROUTES.WHAT_YOU_CAN_DO}>{CREATE_PAGE.browseAll}</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
