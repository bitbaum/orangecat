'use client';

import Image from 'next/image';
import { STUDIO_MEDIA, type StudioMedium } from '@/config/studio';
import type { StudioVersion } from '@/hooks/useStudio';

/**
 * Whatever the Studio just made, playable or readable in place.
 *
 * Native <video>/<audio> rather than a bespoke player: the browser's own
 * controls are better than anything worth building here, and a person judging
 * their own music needs scrubbing and volume, not a custom skin.
 */
export default function StudioResult({
  medium,
  version,
}: {
  medium: StudioMedium;
  version: StudioVersion;
}) {
  const meta = STUDIO_MEDIA[medium];

  if (medium === 'writing') {
    return (
      <article className="oc-surface p-5 sm:p-6">
        <h3 className="text-lg font-semibold text-fg-primary">{version.title || 'Untitled'}</h3>
        <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-fg-secondary">
          {version.text}
        </div>
      </article>
    );
  }

  if (!version.url) {
    return null;
  }

  return (
    <section className="oc-surface overflow-hidden">
      {medium === 'video' && (
        // footage has no transcript to caption; the prompt above is the
        // description, and inventing captions would be worse than none.
        <video src={version.url} controls playsInline className="w-full bg-surface-page" />
      )}
      {medium === 'music' && (
        <div className="p-5 sm:p-6">
          {}
          <audio src={version.url} controls className="w-full" />
        </div>
      )}
      {medium === 'image' && (
        <Image
          src={version.url}
          alt={version.prompt.slice(0, 200)}
          width={1024}
          height={1024}
          unoptimized
          className="h-auto w-full"
        />
      )}
      <p className="border-t border-default px-5 py-3 text-xs text-fg-tertiary sm:px-6">
        {meta.name} · version {version.id}
        {version.note ? ` · you asked: “${version.note}”` : ''}
      </p>
    </section>
  );
}
