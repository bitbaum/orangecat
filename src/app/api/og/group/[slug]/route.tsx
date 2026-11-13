/**
 * GET /api/og/group/[slug] — share card for a group profile.
 *
 * Fills the gap audited in 2026-06-03: group OG metadata had NO image,
 * so every group share rendered as text-only on WhatsApp/Slack/Telegram.
 *
 * Public, unauthenticated. Cached 1h at the edge.
 *
 * A slug with no group gets the plain brand card, never one built from the
 * URL (any made-up name used to render as an OrangeCat group). No "/slug"
 * pill either: that path 404s, the page is /groups/<slug>, and the preview
 * shows the real link beside the card anyway.
 *
 * Created: 2026-06-03
 */

import { ImageResponse } from 'next/og';
import { createServerClient } from '@/lib/supabase/server';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { DATABASE_TABLES } from '@/config/database-tables';
import { APP_NAME, APP_KICKER } from '@/config/brand';
import { OG_SIZE, OG_COLOR, Avatar, BrandFooter } from '@/lib/og/branding';
import { brandOnlyCard } from '@/lib/og/project-card';
import { shareLine } from '@/lib/og/share-line';

// Must be a string literal — Next.js static-analyzes `runtime` at build
// time and cannot resolve imported identifiers (see OG_RUNTIME in
// src/lib/og/branding.tsx for documentation).
export const runtime = 'edge';
export const contentType = 'image/png';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

interface GroupRow {
  name: string;
  description: string | null;
  avatar_url: string | null;
}

export async function GET(_req: Request, { params }: RouteContext) {
  const { slug } = await params;
  const supabase = await createServerClient();

  const { data } = await supabase
    .from(DATABASE_TABLES.GROUPS)
    .select('name, description, avatar_url')
    .eq('slug', slug)
    .maybeSingle();

  const group = data as GroupRow | null;
  if (!group) {
    return brandOnlyCard();
  }

  const description = shareLine(group.description);

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 40, flex: 1 }}>
        <Avatar src={group.avatar_url} fallback={group.name} />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 12 }}>
          <span
            style={{
              display: 'flex',
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: 3,
              color: OG_COLOR.accent,
              textTransform: 'uppercase',
            }}
          >
            {ENTITY_REGISTRY.group.name}
          </span>
          <span
            style={{
              display: 'flex',
              fontSize: 56,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
            }}
          >
            {group.name}
          </span>
          {description && (
            <span
              style={{
                display: 'flex',
                fontSize: 24,
                color: OG_COLOR.textMuted,
                lineHeight: 1.4,
                marginTop: 8,
              }}
            >
              {description}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <BrandFooter wordmark={APP_NAME} tagline={APP_KICKER} />
      </div>
    </div>,
    { ...OG_SIZE, headers: { 'cache-control': 'public, max-age=3600, s-maxage=3600' } }
  );
}
