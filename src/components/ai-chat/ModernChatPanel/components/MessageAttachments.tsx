/**
 * What a user message carried: photos as photos, files and references as
 * chips. A photo is shown from the sender's own copy while the turn is live
 * (`previews`), and from private storage once the thread is reloaded — a file
 * name alone did not tell anyone which picture it was.
 */

import { FileText, Image as ImageIcon, Package } from 'lucide-react';
import { API_ROUTES } from '@/config/api-routes';
import type { ParsedUserMessage } from '@/lib/chat/attachment-tags';
import { referenceLabel } from './ComposerAddMenu';

interface MessageAttachmentsProps {
  attached: ParsedUserMessage;
  /** Data URLs of the photos just sent, in tag order. */
  previews?: string[];
}

export function MessageAttachments({ attached, previews = [] }: MessageAttachmentsProps) {
  const { images, files, refs } = attached;
  if (images.length + files.length + refs.length === 0) {
    return null;
  }
  const photos = images.map((img, i) => ({
    name: img.name,
    src: previews[i] ?? (img.ref ? API_ROUTES.CAT.ATTACHMENT(img.ref) : null),
  }));

  return (
    <div className="mb-1.5 flex flex-col items-end gap-1.5">
      {photos.some(p => p.src) && (
        <div className="flex flex-wrap justify-end gap-1.5">
          {photos
            .filter((p): p is { name: string; src: string } => Boolean(p.src))
            .map((p, i) => (
              <a key={`p${i}`} href={p.src} target="_blank" rel="noopener noreferrer">
                {/* Private, signed or data URLs: nothing for next/image to optimise. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.src}
                  alt={p.name}
                  className="max-h-48 max-w-[16rem] rounded-xl border border-subtle object-cover"
                />
              </a>
            ))}
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-1.5">
        {photos
          .filter(p => !p.src)
          .map((p, i) => (
            <span key={`i${i}`} className="oc-chat-attachment">
              <ImageIcon className="h-3.5 w-3.5 flex-shrink-0 text-fg-secondary" />
              <span className="min-w-0 truncate">{p.name}</span>
            </span>
          ))}
        {files.map((f, i) => (
          <span key={`f${i}`} className="oc-chat-attachment">
            <FileText className="h-3.5 w-3.5 flex-shrink-0 text-fg-secondary" />
            <span className="min-w-0 truncate">{f.name}</span>
          </span>
        ))}
        {refs.map((r, i) => (
          <span key={`r${i}`} className="oc-chat-attachment">
            <Package className="h-3.5 w-3.5 flex-shrink-0 text-fg-secondary" />
            <span className="min-w-0 truncate">{r.title}</span>
            <span className="flex-shrink-0 text-fg-tertiary">{referenceLabel(r.type)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
