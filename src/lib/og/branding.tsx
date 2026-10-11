/**
 * Shared design tokens for next/og image generators.
 *
 * next/og (Satori) doesn't support Tailwind — every style is inline.
 * Keep this file as the SSOT for share-card colours / spacing / typography
 * so every OG image (homepage, profile, group, project) looks like the
 * same product.
 *
 * Matches the x.ai-adjacent neutral-primary palette shipped in 096d6b9c.
 *
 * Created: 2026-06-03
 */

import { BRAND_MARK } from '@/config/brand-mark';

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = 'image/png' as const;

// NOTE: Next.js static-analyzes route-level `export const runtime = '...'`
// at build time and CANNOT resolve imported identifiers — using
// `export const runtime = OG_RUNTIME` produces "Unknown identifier
// 'OG_RUNTIME' at 'runtime'" and breaks `next build`. Each OG route
// declares `export const runtime = 'edge'` directly. This constant is
// kept as documentation of the chosen runtime; do not re-import it as
// a route config value.
export const OG_RUNTIME = 'edge' as const;

export const OG_COLOR = {
  /** Near-black surface (matches `--background` dark mode). */
  surface: '#0A0A0A',
  /** Card surface a hair lighter than the background. */
  card: '#141414',
  /** Hairline border. */
  border: '#262626',
  /** Primary text. */
  text: '#FAFAFA',
  /** Secondary / muted text. */
  textMuted: 'rgba(250,250,250,0.65)',
  /** Tertiary / kicker text. */
  textDim: 'rgba(250,250,250,0.45)',
  /** Warm accent — for tiny indicators only, never the dominant element. */
  accent: '#FF5C00',
  /** Subtle backgrounds for tags / pills. */
  glass: 'rgba(255,255,255,0.06)',
} as const;

/**
 * The brand mark on share cards — BRAND_MARK, whichever file
 * src/config/marks/<APP_SLUG>.ts holds, drawn shape by shape. Inline SVG so
 * satori renders it without a font or an external asset. This used to draw
 * its own "window with ears", a third mark that only share cards ever showed.
 */
export function BrandMarkSvg({ size = 56 }: { size?: number }) {
  const mark = BRAND_MARK;
  return (
    <svg
      width={size}
      height={size}
      viewBox={mark.viewBox.join(' ')}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {mark.shapes.map((shape, i) =>
        shape.paint === 'stroke' ? (
          <path
            key={i}
            d={shape.d}
            fill="none"
            stroke={OG_COLOR.text}
            strokeWidth={shape.strokeWidth ?? mark.strokeWidth}
            strokeLinecap={shape.linecap}
            strokeLinejoin={shape.linejoin}
            opacity={shape.opacity}
          />
        ) : (
          <path
            key={i}
            d={shape.d}
            fill={OG_COLOR.text}
            fillRule={shape.fillRule}
            opacity={shape.opacity}
          />
        )
      )}
    </svg>
  );
}

/**
 * The bottom-of-card row (brand mark + wordmark + tagline) — shared by
 * every share card so consumers see "OrangeCat" attribution consistently
 * regardless of whose profile they're looking at.
 */
export function BrandFooter({ wordmark, tagline }: { wordmark: string; tagline: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        paddingTop: 28,
        borderTop: `1px solid ${OG_COLOR.border}`,
      }}
    >
      <BrandMarkSvg size={44} />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span
          style={{
            display: 'flex',
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: 2,
            color: OG_COLOR.textDim,
            textTransform: 'uppercase',
          }}
        >
          {tagline}
        </span>
        <span
          style={{
            display: 'flex',
            fontSize: 26,
            fontWeight: 700,
            color: OG_COLOR.text,
          }}
        >
          {wordmark}
        </span>
      </div>
    </div>
  );
}

/** Card with a pill-style stat — small block users see "live data" energy from. */
export function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: OG_COLOR.glass,
        border: `1px solid ${OG_COLOR.border}`,
        borderRadius: 16,
        padding: '16px 24px',
        minWidth: 140,
      }}
    >
      <span
        style={{
          display: 'flex',
          fontSize: 32,
          fontWeight: 700,
          color: OG_COLOR.text,
          lineHeight: 1.2,
        }}
      >
        {value}
      </span>
      <span
        style={{
          display: 'flex',
          fontSize: 16,
          color: OG_COLOR.textMuted,
          marginTop: 4,
        }}
      >
        {label}
      </span>
    </div>
  );
}

/** Avatar disk — works for both real avatar_url and initials fallback. */
export function Avatar({ src, fallback }: { src?: string | null; fallback: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Satori/ImageResponse OG renderer: next/image cannot render here, only plain elements
      <img
        src={src}
        alt=""
        width={140}
        height={140}
        style={{
          width: 140,
          height: 140,
          borderRadius: 70,
          objectFit: 'cover',
          border: `2px solid ${OG_COLOR.border}`,
        }}
      />
    );
  }
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 140,
        height: 140,
        borderRadius: 70,
        background: OG_COLOR.glass,
        border: `2px solid ${OG_COLOR.border}`,
        fontSize: 60,
        fontWeight: 700,
        color: OG_COLOR.text,
      }}
    >
      {fallback.slice(0, 1).toUpperCase()}
    </div>
  );
}
