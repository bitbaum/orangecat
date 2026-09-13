'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

// Pull the first grapheme of the title, uppercased. Skips leading whitespace
// and emoji-style symbols (which read as mojibake at large sizes) so a title
// like "  ✨ Open Source Privacy Tools" still surfaces as "O", not "✨".
function titleInitial(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) {
    return '·';
  }
  const firstLetter = trimmed.match(/[\p{Letter}\p{Number}]/u);
  return (firstLetter?.[0] ?? trimmed[0] ?? '·').toUpperCase();
}

/**
 * Stable-per-title hash so the same project always gets the same gradient.
 * Plain old djb2 — enough variety for visual differentiation, no need for
 * crypto-grade.
 */
function titleHash(title: string): number {
  let h = 5381;
  for (let i = 0; i < title.length; i++) {
    h = ((h * 33) ^ title.charCodeAt(i)) >>> 0;
  }
  return h;
}

/**
 * Curated gradient palettes built from the Loki-semantic design tokens
 * so the placeholders re-theme with the rest of the app and never clash with
 * the active palette. Each entry is a Tailwind className that mounts on the
 * absolute-positioned gradient layer.
 */
const PLACEHOLDER_GRADIENTS = [
  'bg-gradient-to-br from-accent-warm/20 via-accent-warm/5 to-transparent',
  'bg-gradient-to-br from-status-positive/20 via-status-positive-subtle to-transparent',
  'bg-gradient-to-br from-status-warning/20 via-status-warning-subtle to-transparent',
  'bg-gradient-to-tr from-accent-warm/15 via-surface-raised to-status-positive/10',
  'bg-gradient-to-tr from-status-warning/15 via-surface-raised to-accent-warm/15',
  'bg-gradient-to-bl from-status-positive/15 via-surface-raised to-status-warning/15',
  'bg-gradient-to-b from-accent-warm/10 to-status-positive/10',
  'bg-gradient-to-r from-surface-raised via-accent-warm/15 to-surface-raised',
] as const;

function ImagePlaceholder({ title }: { title: string }) {
  const initial = titleInitial(title);
  const gradient = PLACEHOLDER_GRADIENTS[titleHash(title) % PLACEHOLDER_GRADIENTS.length];
  return (
    <div
      className={cn(
        'relative flex h-full w-full items-center justify-center overflow-hidden bg-surface-raised/40',
        gradient
      )}
      role="img"
      aria-label={`${title} — no cover image`}
    >
      {/* Soft radial vignette so the initial doesn't float in dead center */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/[0.04] to-transparent" />
      <span
        className="relative select-none font-heading text-6xl font-bold tracking-display text-fg-primary/30 mix-blend-multiply"
        aria-hidden="true"
      >
        {initial}
      </span>
    </div>
  );
}

function ImageLoader() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-surface-raised/40">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-strong border-t-fg-primary" />
    </div>
  );
}

interface EntityCardImageProps {
  imageSrc: string | undefined | null;
  title: string;
  compact: boolean;
  href: string;
}

export function EntityCardImage({ imageSrc, title, compact, href }: EntityCardImageProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const showImage = imageSrc && !imageError;

  return (
    <Link
      href={href}
      className={cn(
        'relative w-full overflow-hidden bg-surface-raised block',
        compact ? 'aspect-[4/3]' : 'aspect-video'
      )}
    >
      {showImage ? (
        <>
          <Image
            src={imageSrc!}
            alt={title}
            fill
            className={cn(
              'object-cover transition-all duration-300',
              imageLoaded && 'group-hover:scale-105',
              !imageLoaded && 'opacity-0'
            )}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            unoptimized={imageSrc!.startsWith('data:') || imageSrc!.startsWith('blob:')}
            onError={() => setImageError(true)}
            onLoad={() => setImageLoaded(true)}
          />
          {!imageLoaded && <ImageLoader />}
        </>
      ) : (
        <ImagePlaceholder title={title} />
      )}
    </Link>
  );
}
