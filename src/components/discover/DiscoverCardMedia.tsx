'use client';

import { useEffect, useRef, useState } from 'react';
import { Face } from '@/components/companions/talk/CompanionFace';
import { EntityCoverPlaceholder } from '@/components/entity/EntityCoverPlaceholder';
import { cn } from '@/lib/utils';
import type { EntityType } from '@/config/entity-registry';

/** First letter or digit of a name, for a person with no portrait. */
export function initialOf(title: string): string {
  return (title.match(/[\p{L}\p{N}]/u)?.[0] ?? '·').toUpperCase();
}

/**
 * A card's picture. Without one (or when it fails to load) a thing shows its
 * kind's icon — the same stand-in on every list (EntityCoverPlaceholder) —
 * and a person their initial in a round, as avatars do everywhere else. A
 * person and a bot are met by a face: theirs is a round portrait, not a cover.
 */
export function DiscoverCardMedia({
  src,
  title,
  type,
  round = false,
}: {
  src: string | null;
  title: string;
  /** The kind, for the stand-in. A person has none. */
  type?: EntityType | null;
  /** A face (a person, a bot): a round portrait on the card's surface, not a cover. */
  round?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  const showImage = !!src && !failed;

  // A picture that failed while the server-rendered page was still loading
  // fired its error before React was listening; catch it on mount instead.
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) {
      setFailed(true);
    }
  }, []);

  return (
    <div className="oc-discover-media">
      {showImage ? (
        // A plain <img>: listing pictures come from any host their owner
        // used, which next/image refuses unless each host is configured —
        // and a refused host was a broken page, not a missing picture.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={img}
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className={cn(
            'object-cover transition-transform duration-300',
            round
              ? 'h-18 w-18 rounded-full'
              : 'absolute inset-0 h-full w-full group-hover:scale-[1.03]'
          )}
          onError={() => setFailed(true)}
        />
      ) : type === 'ai_assistant' ? (
        // A bot with no picture wears the face its name picks, as in Talk.
        <Face name={title} size={72} />
      ) : round ? (
        <span
          aria-hidden
          className="oc-mark-monogram flex h-18 w-18 items-center justify-center rounded-full border border-border-subtle text-3xl text-fg-secondary"
        >
          {initialOf(title)}
        </span>
      ) : (
        <EntityCoverPlaceholder type={type} className="absolute inset-0" />
      )}
    </div>
  );
}
