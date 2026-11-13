'use client';

import Link from 'next/link';
import type { RefObject } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  CREATE_CATEGORY_LABELS,
  CREATE_OPTIONS,
  CREATE_PAGE,
  groupCreateOptions,
  type CreateOption,
} from '@/config/create-options';
import { ENTITY_REGISTRY, type EntityType } from '@/config/entity-registry';
import { ROUTES } from '@/config/routes';
import { VoiceCreate } from '@/components/create/VoiceCreate';
import { CreateOptionRowContent } from '@/components/create/CreateOptionRow';

interface MobileCreateSheetProps {
  /** Whether the sheet is visible */
  isOpen: boolean;
  /** Callback when sheet should close */
  onClose: () => void;
  /** Optional callback when an option is selected (before navigation) */
  onSelect?: (option: CreateOption) => void;
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
  /** The kind the current page is about (Groups → a group): offered first. */
  suggestedType?: EntityType;
}

const ROW_CLASS =
  'flex min-h-11 touch-manipulation items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-surface-raised active:bg-surface-raised';

/** The suggested option, if the page names one the list holds. */
export function findSuggestedOption(suggestedType?: EntityType): CreateOption | undefined {
  if (!suggestedType) {
    return undefined;
  }
  const href = ENTITY_REGISTRY[suggestedType]?.createPath;
  return CREATE_OPTIONS.find(option => option.href === href);
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
  suggestedType,
}: MobileCreateSheetProps) {
  const suggested = findSuggestedOption(suggestedType);
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
        className="oc-interface bottom-0 left-0 top-auto z-modal flex max-h-[85dvh] flex-col max-w-none translate-x-0 translate-y-0 gap-3 rounded-t-lg p-4 pb-8 sm:max-w-none sm:rounded-b-none"
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

        {/* The page you are on is a shortcut inside the sheet, never a
            relabelled tab: the plus is always "Create" and always opens this. */}
        {suggested && (
          <Link
            href={suggested.href}
            onClick={() => handleSelect(suggested)}
            className={cn(ROW_CLASS, 'border border-default bg-surface-raised')}
          >
            <CreateOptionRowContent option={suggested} />
          </Link>
        )}

        {/* The header menu's rows, grouped the same way. */}
        <div className="-mx-1 space-y-3 overflow-y-auto">
          {groupCreateOptions(CREATE_OPTIONS).map(group => (
            <section key={group.category} aria-labelledby={`create-sheet-${group.category}`}>
              <h3
                id={`create-sheet-${group.category}`}
                className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-fg-secondary"
              >
                {CREATE_CATEGORY_LABELS[group.category]}
              </h3>
              {group.items.map(option => (
                <Link
                  key={option.href}
                  href={option.href}
                  onClick={() => handleSelect(option)}
                  className={ROW_CLASS}
                >
                  <CreateOptionRowContent option={option} />
                </Link>
              ))}
            </section>
          ))}
          <Link
            href={ROUTES.WHAT_YOU_CAN_DO}
            onClick={onClose}
            className="flex min-h-11 items-center px-3 text-sm text-fg-secondary underline underline-offset-2 hover:text-fg-primary"
          >
            {CREATE_PAGE.browseAll}
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default MobileCreateSheet;
