/**
 * GET /api/og/project/[id] — the share card for a project.
 *
 * A project is what people share to raise money, and its link used to
 * preview as the creator's avatar: Loki's page showed Cato's face, and a
 * creator without an avatar fell back to /images/og-default.png, a file that
 * has never existed. Now the card is the project's own: its face (its studio
 * mark when the fleet map knows it, else its cover image, else its initial),
 * its title, one line on what it is, who is behind it, and how backing works.
 *
 * "Back it in Bitcoin" only when a backer can actually pay it: the same wallet
 * resolution the page uses. A project nobody can pay yet (no wallet, or set up
 * for someone who has not taken it over) said it anyway (QA 2026-11-12).
 *
 * No amounts. A cached image cannot keep a currency conversion honest, and a
 * stale "CHF 0 of 5,000" on a card someone shared last week is worse than none.
 *
 * Drafts render the plain brand card: a project not yet public must not
 * leak its title through a share URL.
 *
 * Node runtime (not edge) because the studio lookup goes through the shared
 * fleet-map fetcher. Cached an hour at the edge, like the profile card.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { getTableName } from '@/config/entity-registry';
import { markFor } from '@/config/marks';
import { isProjectPubliclyVisible } from '@/config/project-statuses';
import { resolveSellerReceiveInfo } from '@/domain/payments';
import { brandOnlyCard, projectCardResponse } from '@/lib/og/project-card';
import { createServerClient } from '@/lib/supabase/server';
import { getStudioProject } from '@/services/loki/studio-project';

// Must be a string literal — Next.js static-analyzes `runtime` at build time.
export const runtime = 'nodejs';
export const contentType = 'image/png';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface ProjectRow {
  title: string;
  description: string | null;
  status: string | null;
  cover_image_url: string | null;
  logo_url: string | null;
  user_id: string | null;
}

export async function GET(_req: Request, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data } = await supabase
    .from(getTableName('project'))
    .select('title, description, status, cover_image_url, logo_url, user_id')
    .eq('id', id)
    .maybeSingle();
  const project = data as ProjectRow | null;

  if (!project || !isProjectPubliclyVisible(project.status)) {
    return brandOnlyCard();
  }

  const [creatorRes, studio, receive] = await Promise.all([
    project.user_id
      ? supabase
          .from(DATABASE_TABLES.PROFILES)
          .select('name, username')
          .eq('id', project.user_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    getStudioProject(id),
    // Unknown is not a yes: a failed lookup leaves the backing line off.
    resolveSellerReceiveInfo('project', id).catch(() => null),
  ]);
  const creator = creatorRes.data as { name: string | null; username: string | null } | null;

  return projectCardResponse({
    title: project.title,
    description: project.description,
    coverImageUrl: project.cover_image_url,
    logoUrl: project.logo_url,
    creatorName: creator?.name || (creator?.username ? `@${creator.username}` : null),
    mark: studio ? markFor(studio.slug) : null,
    isStudio: Boolean(studio),
    canReceive: receive !== null,
  });
}
