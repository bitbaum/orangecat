'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HeaderIconButton } from '@/components/layout/HeaderIconButton';
import { CreateOptionList } from '@/components/create/CreateOptionList';
import { VoiceCreate } from '@/components/create/VoiceCreate';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
        {/* The same list as /create and the phone's sheet. Each row is a
            menu item, so arrow keys still move between them. */}
        <CreateOptionList
          className="mt-2"
          onNavigate={() => setIsOpen(false)}
          wrapRow={(row, key) => (
            <DropdownMenuItem key={key} asChild className="rounded-none">
              {row}
            </DropdownMenuItem>
          )}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
