/**
 * What is attached to the next message, as removable chips under the
 * composer's text — a thumbnail for a photo, an icon for a file or reference.
 * Also `readPhoto`, which turns a picked photo into what the chat sends.
 */

import { FileText, Package, X } from 'lucide-react';
import { shrinkToFit } from '@/services/images/upload';
import { CHAT_IMAGE_MAX_EDGE_PX } from '@/services/cat/chat-images';
import { referenceLabel } from './ComposerAddMenu';
import type { ChatAttachment } from '../attachments';

/** A phone photo is 3–12 MB; a model reads a 1568px re-encode just as well. */
const PHOTO_MAX_BYTES = 1.5 * 1024 * 1024;

/** Downscale in the browser and hand back a data URL, or null if unreadable. */
export async function readPhoto(file: File): Promise<string | null> {
  const blob = await shrinkToFit(file, {
    maxDimension: CHAT_IMAGE_MAX_EDGE_PX,
    maxBytes: PHOTO_MAX_BYTES,
  });
  if (!blob) {
    return null;
  }
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

interface ComposerAttachmentsProps {
  attachments: ChatAttachment[];
  onRemove: (id: string) => void;
}

export function ComposerAttachments({ attachments, onRemove }: ComposerAttachmentsProps) {
  if (attachments.length === 0) {
    return null;
  }
  return (
    <ul className="flex flex-wrap gap-1.5 px-1 pb-1" aria-label="Attached">
      {attachments.map(a => {
        const label = a.kind === 'ref' ? a.ref.title : a.name;
        return (
          <li key={a.id} className="oc-chat-attachment">
            {a.kind === 'image' ? (
              // A data URL has nothing for next/image to optimise.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.dataUrl} alt="" className="h-6 w-6 flex-shrink-0 rounded object-cover" />
            ) : a.kind === 'file' ? (
              <FileText className="h-3.5 w-3.5 flex-shrink-0 text-fg-secondary" />
            ) : (
              <Package className="h-3.5 w-3.5 flex-shrink-0 text-fg-secondary" />
            )}
            <span className="min-w-0 truncate">{label}</span>
            {a.kind === 'ref' && (
              <span className="flex-shrink-0 text-fg-tertiary">{referenceLabel(a.ref.type)}</span>
            )}
            <button
              type="button"
              onClick={() => onRemove(a.id)}
              className="-mr-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-fg-tertiary hover:bg-surface-raised hover:text-fg-primary"
              aria-label={`Remove ${label}`}
            >
              <X className="h-3 w-3" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
