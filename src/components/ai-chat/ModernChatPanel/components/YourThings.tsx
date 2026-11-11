/**
 * "Your things" — what only OrangeCat can bring INTO a message, as rows in
 * chatkit's own attach sheet (`composer.attachExtras`), under Camera ·
 * Photos · Files, with chatkit's one row anatomy:
 *   - One of your things   → opens the picker below: a listing or note you own
 *   - Context documents    → notes the Cat reads on EVERY message
 *   - Connections & keys   → your AI keys and what the Cat may do
 * No "connect Google Drive" that does nothing: a row that is not wired is a
 * promise the product breaks the moment it is tapped.
 */

import { FolderOpen, Package, Plug } from 'lucide-react';
import { Sheet, type AttachExtra } from '@bitbaum/chatkit/react';
import { CAT_HUB_TAB_HREFS } from '@/config/cat-hub';
import { ENTITY_REGISTRY, type EntityType } from '@/config/entity-registry';
import type { CatReference } from '@/config/cat-prompts';

export const referenceLabel = (type: string): string =>
  type === 'document' ? 'Note' : (ENTITY_REGISTRY[type as EntityType]?.name ?? type);

const icon = 'h-5 w-5';

/** The Cat's rows in the attach sheet. */
export function yourThingsRows({
  openThings,
  go,
}: {
  /** Open the picker of the person's own things. */
  openThings: () => void;
  /** Navigate in the app. */
  go: (href: string) => void;
}): AttachExtra[] {
  return [
    {
      id: 'things',
      label: 'One of your things',
      detail: 'A listing or note you own',
      icon: <Package className={icon} />,
      onPick: openThings,
    },
    {
      id: 'context',
      label: 'Context documents',
      detail: 'Notes Cat reads on every message',
      icon: <FolderOpen className={icon} />,
      onPick: () => go(CAT_HUB_TAB_HREFS.context),
    },
    {
      id: 'controls',
      label: 'Connections & keys',
      detail: 'Your AI keys and what Cat may do',
      icon: <Plug className={icon} />,
      onPick: () => go(CAT_HUB_TAB_HREFS.controls),
    },
  ];
}

const rowClass =
  'flex w-full min-h-11 items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-fg-primary transition-colors hover:bg-surface-raised focus-visible:bg-surface-raised focus-visible:outline-none';

interface YourThingsSheetProps {
  open: boolean;
  onClose: () => void;
  attachable: CatReference[];
  onReference: (ref: CatReference) => void;
}

/** The picker "One of your things" opens: a pick stages it for the next message. */
export function YourThingsSheet({ open, onClose, attachable, onReference }: YourThingsSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Your things" closeLabel="Close">
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
                onClose();
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
    </Sheet>
  );
}
