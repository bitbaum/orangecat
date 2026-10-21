/**
 * The composer's "+" — everything you can bring INTO a message, in one place,
 * the way ChatGPT/Claude/Grok consolidate it. It is chatkit's attach sheet
 * (Camera · Photos · Files, one input per source — see `ATTACH_SOURCE_INPUT`
 * for why) with OrangeCat's own rows under them:
 *   - Add one of your things    → a reference to a listing or note you own
 *   - Context documents         → notes the Cat reads on EVERY message
 *   - Connections & keys        → your AI keys and what the Cat may do
 * With those rows the sheet opens on a mouse too (a file dialog cannot hold
 * them). No "connect Google Drive" that does nothing: a menu item that is not
 * wired is a promise the product breaks the moment it is tapped.
 */

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, FolderOpen, Package, Plug } from 'lucide-react';
import { AttachMenu } from '@bitbaum/chatkit/react';
import { cn } from '@/lib/utils';
import { CAT_HUB_TAB_HREFS } from '@/config/cat-hub';
import { ENTITY_REGISTRY, type EntityType } from '@/config/entity-registry';
import type { CatReference } from '@/config/cat-prompts';
import { ATTACH_SOURCES } from '../attachments';

interface ComposerAddMenuProps {
  attachable: CatReference[];
  onFiles: (files: FileList) => void;
  onReference: (ref: CatReference) => void;
  disabled?: boolean;
}

export const referenceLabel = (type: string): string =>
  type === 'document' ? 'Note' : (ENTITY_REGISTRY[type as EntityType]?.name ?? type);

const SOURCE_LABELS = Object.fromEntries(ATTACH_SOURCES.map(s => [s.id, s.label])) as Record<
  'camera' | 'photos' | 'files',
  string
>;

const rowClass =
  'flex w-full min-h-11 items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-fg-primary transition-colors hover:bg-surface-raised focus-visible:bg-surface-raised focus-visible:outline-none';

export function ComposerAddMenu({
  attachable,
  onFiles,
  onReference,
  disabled,
}: ComposerAddMenuProps) {
  const [view, setView] = useState<'main' | 'things'>('main');

  return (
    <AttachMenu
      onFiles={files => {
        if (files && files.length > 0) {
          onFiles(files);
        }
      }}
      disabled={disabled}
      onOpenChange={open => {
        if (open) {
          setView('main');
        }
      }}
      labels={{
        attach: 'Add files and more',
        title: 'Add to message',
        close: 'Close',
        sources: SOURCE_LABELS,
      }}
      extra={close =>
        view === 'main' ? (
          <>
            <button
              type="button"
              className={cn(rowClass, attachable.length === 0 && 'opacity-50')}
              disabled={attachable.length === 0}
              onClick={() => setView('things')}
            >
              <Package className="h-4 w-4 text-fg-secondary" />
              <span className="flex-1">Add one of your things</span>
            </button>
            <Link href={CAT_HUB_TAB_HREFS.context} className={rowClass} onClick={close}>
              <FolderOpen className="h-4 w-4 text-fg-secondary" />
              <span className="flex-1">
                Context documents
                <span className="block text-xs text-fg-tertiary">
                  Notes Cat reads on every message
                </span>
              </span>
            </Link>
            <Link href={CAT_HUB_TAB_HREFS.controls} className={rowClass} onClick={close}>
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
              className={cn(rowClass, 'text-fg-secondary')}
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
              ))}
            </div>
          </>
        )
      }
    />
  );
}
