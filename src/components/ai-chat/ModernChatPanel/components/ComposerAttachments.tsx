/**
 * The person's own things staged for the next message, as removable chips
 * inside the composer (chatkit's `header` slot). Photos and files are
 * chatkit's own strip above the text; these are what it has no model for —
 * a reference to a listing or a note — so the app holds them and the
 * composer counts them (`heldAttachments`).
 */

import { Package, X } from 'lucide-react';
import type { CatReference } from '@/config/cat-prompts';
import { referenceLabel } from './YourThings';

interface ComposerAttachmentsProps {
  references: CatReference[];
  onRemove: (ref: CatReference) => void;
}

export function ComposerAttachments({ references, onRemove }: ComposerAttachmentsProps) {
  if (references.length === 0) {
    return null;
  }
  return (
    <ul className="flex flex-wrap gap-1.5 px-1 pb-1" aria-label="Attached">
      {references.map(ref => (
        <li key={`${ref.type}:${ref.id}`} className="oc-chat-attachment">
          <Package className="h-3.5 w-3.5 flex-shrink-0 text-fg-secondary" />
          <span className="min-w-0 truncate">{ref.title}</span>
          <span className="flex-shrink-0 text-fg-tertiary">{referenceLabel(ref.type)}</span>
          <button
            type="button"
            onClick={() => onRemove(ref)}
            className="-mr-1 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded text-fg-tertiary hover:text-fg-primary"
            aria-label={`Remove ${ref.title}`}
          >
            <X className="h-3 w-3" />
          </button>
        </li>
      ))}
    </ul>
  );
}
