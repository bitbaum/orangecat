'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HeaderIconButton } from '@/components/layout/HeaderIconButton';
import { CREATE_OPTIONS, shouldShowDivider } from '@/config/create-options';
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
        {CREATE_OPTIONS.map((option, index) => (
          <div key={option.href}>
            <DropdownMenuItem asChild className="min-h-11 gap-3 px-3 py-2.5">
              <Link href={option.href}>
                <div className="oc-icon-tile h-9 w-9 shrink-0">
                  <option.icon className={cn('h-4 w-4', option.color)} aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-fg-primary">{option.name}</div>
                  <div className="text-xs text-fg-secondary">{option.description}</div>
                </div>
              </Link>
            </DropdownMenuItem>
            {shouldShowDivider(option, CREATE_OPTIONS[index + 1]) && <DropdownMenuSeparator />}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
