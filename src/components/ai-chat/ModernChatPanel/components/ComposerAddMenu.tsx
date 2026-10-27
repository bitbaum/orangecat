/**
 * The composer's "Your things" — what only OrangeCat can bring INTO a message.
 * Pictures and files are chatkit's own attach button beside it (Camera ·
 * Photos · Files, with thumbnails); this sheet holds the rest:
 *   - one of your things   → a reference to a listing or note you own
 *   - Context documents    → notes the Cat reads on EVERY message
 *   - Connections & keys   → your AI keys and what the Cat may do
 * No "connect Google Drive" that does nothing: a row that is not wired is a
 * promise the product breaks the moment it is tapped.
 */

import { useState } from 'react';
import Link from 'next/link';
import { FolderOpen, Package, Plug } from 'lucide-react';
import { Sheet } from '@bitbaum/chatkit/react';
import { CAT_HUB_TAB_HREFS } from '@/config/cat-hub';
import { ENTITY_REGISTRY, type EntityType } from '@/config/entity-registry';
import type { CatReference } from '@/config/cat-prompts';

interface ComposerAddMenuProps {
  attachable: CatReference[];
  onReference: (ref: CatReference) => void;
  disabled?: boolean;
}

export const referenceLabel = (type: string): string =>
  type === 'document' ? 'Note' : (ENTITY_REGISTRY[type as EntityType]?.name ?? type);

const rowClass =
  'flex w-full min-h-11 items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-fg-primary transition-colors hover:bg-surface-raised focus-visible:bg-surface-raised focus-visible:outline-none';

export function ComposerAddMenu({ attachable, onReference, disabled }: ComposerAddMenuProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        className="ck-icon-btn"
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-label="Add one of your things"
        aria-haspopup="dialog"
        title="Add one of your things"
      >
        <Package className="h-4 w-4" />
      </button>
      <Sheet open={open} onClose={close} title="Your things" closeLabel="Close">
        <div className="max-h-64 overflow-y-auto">
          {attachable.length === 0 ? (
            <p className="mb-0 px-3 py-2 text-sm text-fg-secondary">
              Nothing to add yet — what you create shows up here.
            </p>
          ) : (
            attachable.map(ref => (
              <button
                key={`${ref.type}:${ref.id}`}
                type="button"
                className={rowClass}
                onClick={() => {
                  onReference(ref);
                  close();
                }}
              >
                <span className="min-w-0 flex-1 truncate">{ref.title}</span>
                <span className="flex-shrink-0 text-xs text-fg-tertiary">
                  {referenceLabel(ref.type)}
                </span>
              </button>
            ))
          )}
        </div>
        <Link href={CAT_HUB_TAB_HREFS.context} className={rowClass} onClick={close}>
          <FolderOpen className="h-4 w-4 text-fg-secondary" />
          <span className="flex-1">
            Context documents
            <span className="block text-xs text-fg-tertiary">Notes Cat reads on every message</span>
          </span>
        </Link>
        <Link href={CAT_HUB_TAB_HREFS.controls} className={rowClass} onClick={close}>
          <Plug className="h-4 w-4 text-fg-secondary" />
          <span className="flex-1">
            Connections &amp; keys
            <span className="block text-xs text-fg-tertiary">Your AI keys and what Cat may do</span>
          </span>
        </Link>
      </Sheet>
    </>
  );
}
