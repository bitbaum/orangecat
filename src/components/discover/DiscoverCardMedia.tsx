'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/** First letter or digit of a title, for a card with no picture. */
export function initialOf(title: string): string {
  return (title.match(/[\p{L}\p{N}]/u)?.[0] ?? '·').toUpperCase();
}

/**
 * A card's picture, or its initial when it has none (or the picture fails to
 * load) — the same stand-in the home page's studio tiles and profile project
 * cards use, so a listing without a photo still has a face.
 */
export function DiscoverCardMedia({
  src,
  title,
  round = false,
}: {
  src: string | null;
  title: string;
  /** A person: a round portrait on the card's surface, not a cover. */
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
      ) : (
        <span
          aria-hidden
          className={cn(
            'oc-mark-monogram text-fg-primary/40',
            round
              ? 'flex h-18 w-18 items-center justify-center rounded-full border border-border-subtle text-3xl'
              : 'text-5xl'
          )}
        >
          {initialOf(title)}
        </span>
      )}
    </div>
  );
}
