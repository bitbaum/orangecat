/**
 * Static homepage OG image — what link-previewers render when someone
 * shares `orangecat.ch` itself. Per-profile and per-group share cards
 * live at /api/og/{profile,group}/[id].
 *
 * The card says the promise (APP_PROMISE) and shows the thing it is about:
 * the pay link. It used to carry four chips, "Fund · Invest · Lend ·
 * Coordinate", a fourth wording of what the home page promises.
 */

import { ImageResponse } from 'next/og';
import { APP_NAME, APP_PROMISE, APP_TAGLINE } from '@/config/brand';
import { PAY_LINK_PLACEHOLDER, payLinkDisplay } from '@/config/pay';
import { OG_SIZE, OG_COLOR, BrandMarkSvg } from '@/lib/og/branding';

// Must be a string literal — Next.js static-analyzes `runtime` at build
// time and cannot resolve imported identifiers.
export const runtime = 'edge';
export const alt = `${APP_NAME} — ${APP_TAGLINE}`;
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: OG_COLOR.surface,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 140,
          height: 140,
          borderRadius: 28,
          background: OG_COLOR.glass,
          border: `1px solid ${OG_COLOR.border}`,
          marginBottom: 40,
        }}
      >
        <BrandMarkSvg size={88} />
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: 72,
          fontWeight: 700,
          color: OG_COLOR.text,
          letterSpacing: '-0.02em',
          marginBottom: 16,
        }}
      >
        {APP_NAME}
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: 28,
          color: OG_COLOR.textMuted,
          marginBottom: 48,
        }}
      >
        {APP_PROMISE}
      </div>
      <div
        style={{
          display: 'flex',
          padding: '12px 28px',
          borderRadius: 100,
          background: OG_COLOR.glass,
          border: `1px solid ${OG_COLOR.border}`,
          color: OG_COLOR.text,
          fontSize: 24,
          fontWeight: 600,
        }}
      >
        {payLinkDisplay(PAY_LINK_PLACEHOLDER)}
      </div>
    </div>,
    { ...size }
  );
}
