/**
 * The composer's "+" — everything you can bring INTO a message, in one place,
 * the way ChatGPT/Claude/Grok consolidate it.
 *
 * Only real capabilities are listed:
 *   - Upload a text file        → attached to this message (see ../attachments)
 *   - Add one of your things    → a reference to a listing or note you own
 *   - Context documents         → notes the Cat reads on EVERY message
 *   - Connections & keys        → your AI keys and what the Cat may do
 * No "connect Google Drive" that does nothing: a menu item that is not wired is
 * a promise the product breaks the moment it is tapped.
 */

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, FolderOpen, Package, Paperclip, Plug, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDropdown } from '@/hooks/useDropdown';
import { CAT_HUB_TAB_HREFS } from '@/config/cat-hub';
import { ENTITY_REGISTRY, type EntityType } from '@/config/entity-registry';
import type { CatReference } from '@/config/cat-prompts';
import { ATTACHMENT_ACCEPT } from '../attachments';

interface ComposerAddMenuProps {
  attachable: CatReference[];
  onFiles: (files: FileList) => void;
  onReference: (ref: CatReference) => void;
  disabled?: boolean;
}

export const referenceLabel = (type: string): string =>
  type === 'document' ? 'Note' : (ENTITY_REGISTRY[type as EntityType]?.name ?? type);

export function ComposerAddMenu({
  attachable,
  onFiles,
  onReference,
  disabled,
}: ComposerAddMenuProps) {
  const { isOpen, toggle, close, dropdownRef, buttonRef } = useDropdown();
  const [view, setView] = useState<'main' | 'things'>('main');
  const fileRef = useRef<HTMLInputElement>(null);

  const itemClass =
    'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-fg-primary transition-colors hover:bg-surface-raised focus-visible:bg-surface-raised focus-visible:outline-none';

  const closeMenu = () => {
    close();
    setView('main');
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setView('main');
          toggle();
        }}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Add files and more"
        title="Add files and more"
        className={cn(
          'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-fg-secondary transition-colors hover:bg-surface-raised hover:text-fg-primary',
          isOpen && 'bg-surface-raised text-fg-primary',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <Plus className={cn('h-5 w-5 transition-transform', isOpen && 'rotate-45')} />
      </button>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept={ATTACHMENT_ACCEPT}
        className="hidden"
        onChange={e => {
          if (e.target.files && e.target.files.length > 0) {
            onFiles(e.target.files);
          }
          // Reset so picking the same file twice still fires onChange.
          e.target.value = '';
        }}
      />

      {isOpen && (
        <div
          ref={dropdownRef}
          role="menu"
          aria-label="Add to message"
          className="oc-chat-menu"
          onKeyDown={e => {
            if (e.key === 'Escape') {
              closeMenu();
              buttonRef.current?.focus();
            }
          }}
        >
          {view === 'main' ? (
            <>
              <button
                type="button"
                role="menuitem"
                className={itemClass}
                onClick={() => {
                  closeMenu();
                  fileRef.current?.click();
                }}
              >
                <Paperclip className="h-4 w-4 text-fg-secondary" />
                <span className="flex-1">Upload a file</span>
                <span className="text-xs text-fg-tertiary">text</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className={cn(itemClass, attachable.length === 0 && 'opacity-50')}
                disabled={attachable.length === 0}
                onClick={() => setView('things')}
              >
                <Package className="h-4 w-4 text-fg-secondary" />
                <span className="flex-1">Add one of your things</span>
              </button>
              <div className="my-1 h-px bg-border-subtle" />
              <Link
                href={CAT_HUB_TAB_HREFS.context}
                role="menuitem"
                className={itemClass}
                onClick={closeMenu}
              >
                <FolderOpen className="h-4 w-4 text-fg-secondary" />
                <span className="flex-1">
                  Context documents
                  <span className="block text-xs text-fg-tertiary">
                    Notes Cat reads on every message
                  </span>
                </span>
              </Link>
              <Link
                href={CAT_HUB_TAB_HREFS.controls}
                role="menuitem"
                className={itemClass}
                onClick={closeMenu}
              >
                <Plug className="h-4 w-4 text-fg-secondary" />
                <span className="flex-1">
                  Connections &amp; keys
                  <span className="block text-xs text-fg-tertiary">
                    Your AI keys and what Cat may do
                  </span>
                </span>
              </Link>
            </>
          ) : (
            <>
              <button
                type="button"
                className={cn(itemClass, 'text-fg-secondary')}
                onClick={() => setView('main')}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="flex-1">Your things</span>
              </button>
              <div className="max-h-64 overflow-y-auto">
                {attachable.map(ref => (
                  <button
                    key={`${ref.type}:${ref.id}`}
                    type="button"
                    role="menuitem"
                    className={itemClass}
                    onClick={() => {
                      onReference(ref);
                      closeMenu();
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate">{ref.title}</span>
                    <span className="flex-shrink-0 text-xs text-fg-tertiary">
                      {referenceLabel(ref.type)}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
