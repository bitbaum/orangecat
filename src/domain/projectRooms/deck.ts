/**
 * A room's deck (docs/features/investor-portal.md): stored as @bitbaum/deckkit
 * data on project_rooms.deck, read and written only through normalizeDeck, and
 * fed live data from the room's evidence so bound slides never go stale.
 * Server-only. Ownership is checked the same way as every other room write.
 */

import { normalizeDeck, type Deck, type DeckData, type DeckSource } from '@bitbaum/deckkit';
import { DATABASE_TABLES } from '@/config/database-tables';
import { ROOM_OUTLINE, type RoomContent } from '@/config/project-room';
import { getAdminClient } from '@/lib/supabase/admin';
import { looseClient } from '@/lib/supabase/untyped';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { APP_LOCALE } from '@/utils/locale';
import { logger } from '@/utils/logger';
import type { RoomEvidence } from './evidence';
import { visibleSections } from './content';
import { loadOwnedProject } from './service';
import type { RoomProject, RoomResult } from './types';

export async function loadRoomDeck(projectId: string): Promise<Deck | null> {
  const { data } = await looseClient(getAdminClient())
    .from(DATABASE_TABLES.PROJECT_ROOMS)
    .select('deck')
    .eq('project_id', projectId)
    .maybeSingle();
  return data?.deck ? normalizeDeck(data.deck) : null;
}

export async function saveRoomDeck(
  projectId: string,
  userId: string,
  supabase: AnySupabaseClient,
  raw: unknown
): Promise<RoomResult<Deck>> {
  const owned = await loadOwnedProject(projectId, userId, supabase);
  if (!owned.ok) {
    return owned;
  }
  const deck = normalizeDeck(raw);
  if (!deck) {
    return { ok: false, code: 'invalid', message: 'A deck needs at least one slide with a title' };
  }

  const admin = looseClient(getAdminClient());
  const now = new Date().toISOString();
  const { data: existing } = await admin
    .from(DATABASE_TABLES.PROJECT_ROOMS)
    .select('project_id')
    .eq('project_id', projectId)
    .maybeSingle();

  // A deck saved before any room text keeps the room's outline, so the room
  // editor still offers the investor sections instead of an empty page.
  const { error } = existing
    ? await admin
        .from(DATABASE_TABLES.PROJECT_ROOMS)
        .update({ deck, deck_updated_at: now })
        .eq('project_id', projectId)
    : await admin.from(DATABASE_TABLES.PROJECT_ROOMS).insert({
        project_id: projectId,
        sections: ROOM_OUTLINE,
        deck,
        deck_updated_at: now,
      });
  if (error) {
    logger.error('Failed to save room deck', { error }, 'ProjectRooms');
    return { ok: false, code: 'db_error', message: 'Could not save the deck' };
  }
  return { ok: true, data: deck };
}

function shortDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(APP_LOCALE, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

/** The live data bound slides read — generated evidence only, never typed numbers. */
export function deckDataFromEvidence(evidence: RoomEvidence): DeckData {
  const { facts, pace, fleet } = evidence;
  const roadmap = fleet
    ? (
        [
          ['Now', 'in progress'],
          ['Next', 'planned'],
          ['Later', 'later'],
        ] as const
      ).map(([heading, status]) => ({
        heading,
        items: fleet.roadmap
          .filter(r => r.status === status)
          .slice(0, 5)
          .map(r => r.title),
      }))
    : undefined;

  return {
    facts: facts.length ? facts.map(f => ({ value: f.value, label: f.label })) : undefined,
    factsSource: facts.length
      ? 'Generated from the public repository and the product’s own records'
      : undefined,
    pace: pace
      ? {
          bars: pace.weeks.map(w => ({ label: shortDate(w.start), value: w.count })),
          caption: `Changes merged to main per week — ${pace.repoUrl.replace(/^https:\/\//, '')}`,
        }
      : undefined,
    roadmap,
    roadmapSource: fleet?.sources.roadmap?.replace(/^https:\/\//, '') ?? undefined,
  };
}

/** What the generator drafts from: the room's own words and the product's record. */
export function deckSourceFromRoom(
  project: RoomProject,
  content: RoomContent,
  evidence: RoomEvidence,
  now: Date = new Date()
): DeckSource {
  const identity = evidence.fleet?.identity;
  return {
    name: project.title,
    headline: content.headline || project.description,
    website: project.website_url,
    identity: identity
      ? { problem: identity.problem, solution: identity.solution, vision: identity.vision }
      : undefined,
    sections: visibleSections(content),
    numbers: content.metrics.map(m => ({ value: m.value, label: m.label })),
    numbersAsOf: content.metrics_as_of
      ? new Date(`${content.metrics_as_of}T12:00:00Z`).toLocaleDateString(APP_LOCALE, {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        })
      : null,
    contactEmail: content.contact_email,
    dateLabel: now.toLocaleDateString(APP_LOCALE, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }),
  };
}
