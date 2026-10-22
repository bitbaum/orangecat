'use client';

import Link from 'next/link';
import type { RefObject } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { CREATE_OPTIONS, type CreateOption } from '@/config/create-options';
import { VoiceCreate } from '@/components/create/VoiceCreate';

interface MobileCreateSheetProps {
  /** Whether the sheet is visible */
  isOpen: boolean;
  /** Callback when sheet should close */
  onClose: () => void;
  /** Optional callback when an option is selected (before navigation) */
  onSelect?: (option: CreateOption) => void;
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
}

/**
 * Mobile Create Sheet
 *
 * A bottom sheet that displays all create options for mobile users.
 * Used by MobileBottomNav when the "+" button triggers a menu.
 */
export function MobileCreateSheet({
  isOpen,
  onClose,
  onSelect,
  returnFocusRef,
}: MobileCreateSheetProps) {
  const handleSelect = (option: CreateOption) => {
    onSelect?.(option);
    onClose();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        className="oc-interface bottom-0 left-0 top-auto z-modal max-h-[85dvh] max-w-none translate-x-0 translate-y-0 gap-3 rounded-t-lg p-4 pb-8 sm:max-w-none sm:rounded-b-none"
        style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
        onCloseAutoFocus={event => {
          if (returnFocusRef?.current) {
            event.preventDefault();
            returnFocusRef.current.focus();
          }
        }}
      >
        <DialogTitle className="flex min-h-11 items-center pr-12">Create</DialogTitle>

        {/* Speaking beats picking a type you don't know the name of yet. Above
            the grid because it's the faster path, not an afterthought. */}
        <VoiceCreate className="mb-3" onNavigate={onClose} />

        {/* Options Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CREATE_OPTIONS.map(option => (
            <Link
              key={option.name}
              href={option.href}
              onClick={() => handleSelect(option)}
              className="flex touch-manipulation flex-col items-center gap-1.5 rounded-md border border-subtle p-3 transition-colors hover:border-strong hover:bg-surface-raised active:bg-surface-raised/80"
            >
              <div className={cn('rounded-md p-2.5', option.bgColor)}>
                <option.icon className={cn('w-5 h-5', option.color)} />
              </div>
              <span className="text-xs font-medium text-fg-primary text-center">{option.name}</span>
            </Link>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default MobileCreateSheet;
