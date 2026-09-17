'use client';

import 'bip-kit/styles.css';
import '@/lib/longform/longform.css';
import LongformPreviewBody from '@/lib/longform/LongformPreviewBody';

/**
 * Read-only preview of the article being composed — the SAME bip-kit blocks
 * and reference renderer the published page uses (sans syntax highlighting,
 * which is server-side), so the preview is honest.
 */
export default function ArticlePreview({
  title,
  excerpt,
  coverImage,
  body,
}: {
  title: string;
  excerpt: string;
  coverImage: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-subtle bg-surface-page p-6">
      {coverImage && (
        // eslint-disable-next-line @next/next/no-img-element -- cover image is a free-form URL (Openverse, AI generation, or user upload) on any host; next/image would throw for hosts outside images.remotePatterns
        <img
          src={coverImage}
          alt=""
          className="mb-8 aspect-[2/1] w-full rounded-md border border-subtle object-cover"
        />
      )}
      <h1 className="text-3xl font-semibold leading-tight tracking-display text-fg-primary">
        {title || 'Untitled'}
      </h1>
      {excerpt && <p className="mt-3 text-lg text-fg-secondary">{excerpt}</p>}
      <div className="mt-6 [&>*:first-child]:mt-0">
        {body.trim() ? (
          <LongformPreviewBody body={body} />
        ) : (
          <p className="text-fg-tertiary">Nothing to preview yet.</p>
        )}
      </div>
    </div>
  );
}
