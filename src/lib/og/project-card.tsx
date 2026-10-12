/**
 * The project share card (1200×630) — see src/app/api/og/project/[id]/route.tsx
 * for why it exists. Satori only understands inline styles; tokens come from
 * OG_COLOR, the share-card SSOT.
 */

import { ImageResponse } from 'next/og';
import { APP_KICKER, APP_NAME } from '@/config/brand';
import type { MarkDefinition } from '@/config/marks/types';
import { BrandFooter, BrandMarkSvg, MarkSvg, OG_COLOR, OG_SIZE } from '@/lib/og/branding';
import { shareLine } from '@/lib/og/share-line';

const CACHE = { 'cache-control': 'public, max-age=3600, s-maxage=3600' };

/** The plain brand card — for drafts and missing projects. */
export function brandOnlyCard() {
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        background: OG_COLOR.surface,
      }}
    >
      <BrandMarkSvg size={180} />
    </div>,
    { ...OG_SIZE, headers: CACHE }
  );
}

export interface ProjectCardProps {
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  creatorName: string | null;
  /** The project's studio mark, when the fleet map knows it. */
  mark: MarkDefinition | null;
  /** True for one of the studio's own products. */
  isStudio: boolean;
}

export function projectCardResponse({
  title,
  description,
  coverImageUrl,
  creatorName,
  mark,
  isStudio,
}: ProjectCardProps) {
  const line = shareLine(description);
  const titleSize = title.length > 48 ? 56 : title.length > 28 ? 68 : 84;
  const face = mark ? (
    <MarkSvg mark={mark} size={150} />
  ) : coverImageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- Satori/ImageResponse renders plain elements only
    <img
      src={coverImageUrl}
      alt=""
      width={240}
      height={240}
      style={{ width: 240, height: 240, objectFit: 'cover', borderRadius: 24 }}
    />
  ) : (
    <span style={{ display: 'flex', fontSize: 132, fontWeight: 700, color: OG_COLOR.text }}>
      {title.trim().charAt(0).toUpperCase()}
    </span>
  );

  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        padding: 64,
        background: OG_COLOR.surface,
        fontFamily: 'system-ui, sans-serif',
        color: OG_COLOR.text,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 56, flex: 1 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 240,
            height: 240,
            flexShrink: 0,
            borderRadius: 32,
            background: OG_COLOR.glass,
            border: `1px solid ${OG_COLOR.border}`,
            overflow: 'hidden',
          }}
        >
          {face}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 18 }}>
          <span
            style={{
              display: 'flex',
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: 4,
              textTransform: 'uppercase',
              color: OG_COLOR.accent,
            }}
          >
            {isStudio ? 'Built in the open' : 'Project'}
            {creatorName ? ` · by ${creatorName}` : ''}
          </span>
          <span
            style={{
              display: 'flex',
              fontSize: titleSize,
              fontWeight: 700,
              letterSpacing: '-0.03em',
              lineHeight: 1.02,
            }}
          >
            {title}
          </span>
          {line && (
            <span
              style={{ display: 'flex', fontSize: 28, lineHeight: 1.35, color: OG_COLOR.textMuted }}
            >
              {line}
            </span>
          )}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ display: 'flex', fontSize: 26, color: OG_COLOR.textMuted }}>
          Back it in Bitcoin — it goes straight to the project.
        </span>
        <BrandFooter wordmark={APP_NAME} tagline={APP_KICKER} />
      </div>
    </div>,
    { ...OG_SIZE, headers: CACHE }
  );
}
