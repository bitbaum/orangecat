/**
 * The share card for anything people pass around that is not a project,
 * profile, group or long read: a product, a service, a cause, an event, a
 * loan, a wishlist, a companion… and a wall post. One layout for all of them,
 * the project card's: a face on the left (the thing's own picture, else its
 * kind's icon on a plate), then the kind and who made it, the title, the one
 * figure that matters, a line about it, and the brand footer.
 *
 * Satori only understands inline styles; tokens come from OG_COLOR.
 */

import { ImageResponse } from 'next/og';
import { APP_KICKER, APP_NAME } from '@/config/brand';
import { BrandFooter, OG_COLOR, OG_SIZE } from '@/lib/og/branding';
import type { IconNode } from '@/lib/og/card-parts';

/** An hour at the edge, like every other card: previewers hit a link hard at share time. */
export const SHARE_CARD_CACHE = { 'cache-control': 'public, max-age=3600, s-maxage=3600' };

export interface ShareCardProps {
  /** The kind, e.g. "Product" — from ENTITY_REGISTRY, never retyped. */
  kicker: string;
  title: string;
  /** Who made it, as makerName() prints it; null prints no byline. */
  maker: string | null;
  /** The one figure: a price, a goal, a date and place. */
  figure?: string | null;
  /** One line about it (shareLine of the description). */
  line?: string | null;
  /** A data URI from loadCardImage(), or null. */
  image?: string | null;
  /** The kind's icon, drawn when there is no image. */
  icon?: IconNode | null;
  /** Round face (a person's avatar) instead of a square cover. */
  roundFace?: boolean;
}

function IconFace({ icon }: { icon: IconNode }) {
  return (
    <svg
      width={128}
      height={128}
      viewBox="0 0 24 24"
      fill="none"
      stroke={OG_COLOR.text}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {icon.map(([tag, attrs], i) => {
        const { key: _key, ...rest } = attrs;
        const Tag = tag as 'path';
        return <Tag key={i} {...(rest as Record<string, string>)} />;
      })}
    </svg>
  );
}

function Face({
  image,
  icon,
  title,
  round,
}: {
  image?: string | null;
  icon?: IconNode | null;
  title: string;
  round: boolean;
}) {
  const radius = round ? 120 : 32;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 240,
        height: 240,
        flexShrink: 0,
        borderRadius: radius,
        background: OG_COLOR.glass,
        border: `1px solid ${OG_COLOR.border}`,
        overflow: 'hidden',
      }}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- Satori/ImageResponse renders plain elements only
        <img
          src={image}
          alt=""
          width={240}
          height={240}
          style={{ width: 240, height: 240, objectFit: 'cover', borderRadius: radius }}
        />
      ) : icon ? (
        <IconFace icon={icon} />
      ) : (
        <span style={{ display: 'flex', fontSize: 132, fontWeight: 700, color: OG_COLOR.text }}>
          {title.trim().charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}

/** Long titles shrink rather than overflow the fixed canvas. */
export function titleSizeFor(title: string): number {
  return title.length > 90 ? 44 : title.length > 48 ? 56 : title.length > 28 ? 68 : 84;
}

/** Render the 1200×630 card as an ImageResponse (PNG). */
export function shareCardResponse({
  kicker,
  title,
  maker,
  figure = null,
  line = null,
  image = null,
  icon = null,
  roundFace = false,
}: ShareCardProps) {
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
        <Face image={image} icon={icon} title={title} round={roundFace} />
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
            {kicker}
            {maker ? ` · by ${maker}` : ''}
          </span>
          <span
            style={{
              display: 'flex',
              fontSize: titleSizeFor(title),
              fontWeight: 700,
              letterSpacing: '-0.03em',
              lineHeight: 1.05,
            }}
          >
            {title}
          </span>
          {figure && (
            <span style={{ display: 'flex', fontSize: 40, fontWeight: 700, color: OG_COLOR.text }}>
              {figure}
            </span>
          )}
          {line && (
            <span
              style={{ display: 'flex', fontSize: 28, lineHeight: 1.35, color: OG_COLOR.textMuted }}
            >
              {line}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <BrandFooter wordmark={APP_NAME} tagline={APP_KICKER} />
      </div>
    </div>,
    { ...OG_SIZE, headers: SHARE_CARD_CACHE }
  );
}
