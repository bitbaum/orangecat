/**
 * Event music, vibe and crew — SSOT.
 *
 * A party is found by what it sounds like and happens because people staff it.
 * The public page, the create form, the Cat's create_event action and the
 * event_roles validation all read these lists; none of them restates one.
 */

import type { EngagementType } from '@/config/project-roles';

// ==================== MUSIC ====================

/**
 * Suggested genres. Free text is allowed too (a scene names itself), so this is
 * the list the form offers and the Cat normalises towards, not an enum.
 */
export const MUSIC_GENRES = [
  'Techno',
  'House',
  'Deep House',
  'Disco',
  'Funk',
  'Hip-Hop',
  'R&B',
  'Afrobeats',
  'Amapiano',
  'Reggaeton',
  'Drum & Bass',
  'Jungle',
  'Dubstep',
  'Trance',
  'Ambient',
  'Jazz',
  'Soul',
  'Rock',
  'Indie',
  'Pop',
  'Latin',
  'Electronic',
  'Live Band',
  'Acoustic',
] as const;

export const MAX_MUSIC_GENRES = 8;
export const MAX_GENRE_LENGTH = 40;
export const MAX_VIBE_LENGTH = 280;

/** Case-insensitive match onto the suggested spelling; unknown genres pass through trimmed. */
export function normalizeGenre(raw: string): string {
  const trimmed = raw.trim().slice(0, MAX_GENRE_LENGTH);
  const known = MUSIC_GENRES.find(g => g.toLowerCase() === trimmed.toLowerCase());
  return known ?? trimmed;
}

/** De-duplicated, normalised, capped. */
export function normalizeGenres(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string' || !item.trim()) {
      continue;
    }
    const genre = normalizeGenre(item);
    if (!out.some(g => g.toLowerCase() === genre.toLowerCase())) {
      out.push(genre);
    }
    if (out.length >= MAX_MUSIC_GENRES) {
      break;
    }
  }
  return out;
}

// ==================== CREW ====================

interface CrewRolePreset {
  /** Display title, singular. */
  title: string;
  /** Words people actually type for it (lower-case, singular and plural). */
  aliases: readonly string[];
  engagement: EngagementType;
  /** People in this role can check guests in at the door. */
  checksIn?: boolean;
}

/** The roles a party usually needs. Order is the order they are suggested in. */
export const EVENT_CREW_PRESETS: readonly CrewRolePreset[] = [
  { title: 'DJ', aliases: ['dj', 'djs', 'deejay', 'selector'], engagement: 'paid' },
  {
    title: 'Bartender',
    aliases: ['bartender', 'bartenders', 'barkeeper', 'barkeepers', 'bar staff', 'bar'],
    engagement: 'paid',
  },
  {
    title: 'Sound technician',
    aliases: ['sound', 'sound tech', 'sound techs', 'sound technician', 'sound engineer', 'audio'],
    engagement: 'paid',
  },
  {
    title: 'Lighting technician',
    aliases: ['lights', 'lighting', 'light tech', 'lighting tech', 'vj', 'vjs'],
    engagement: 'paid',
  },
  {
    title: 'Security',
    aliases: ['security', 'bouncer', 'bouncers'],
    engagement: 'paid',
    checksIn: true,
  },
  {
    title: 'Door',
    aliases: ['door', 'door staff', 'doorperson', 'tickets', 'ticket desk', 'entrance'],
    engagement: 'paid',
    checksIn: true,
  },
  {
    title: 'Photographer',
    aliases: ['photographer', 'photographers', 'photo'],
    engagement: 'paid',
  },
  {
    title: 'Live musician',
    aliases: ['band', 'live band', 'musician', 'musicians', 'live act'],
    engagement: 'paid',
  },
  { title: 'Cook', aliases: ['cook', 'cooks', 'chef', 'food', 'catering'], engagement: 'paid' },
  {
    title: 'Setup & cleanup',
    aliases: [
      'setup',
      'set up',
      'cleanup',
      'clean up',
      'cleaning',
      'runner',
      'runners',
      'helper',
      'helpers',
    ],
    engagement: 'volunteer',
  },
];

export const MAX_EVENT_ROLES = 20;
export const MAX_ROLE_QUANTITY = 50;
export const MAX_EVENT_ROLE_TITLE = 100;

export interface ParsedCrewRole {
  role_title: string;
  quantity: number;
  engagement_type: EngagementType;
  can_check_in: boolean;
}

/**
 * Read one crew line the way a person says it — "DJ", "2 bartenders",
 * "3x security", "sound tech" — into a role. Known roles get their canonical
 * title and usual engagement; anything else is kept as written, paid.
 */
export function parseCrewRole(raw: string): ParsedCrewRole | null {
  const text = raw.trim().replace(/\s+/g, ' ');
  if (!text) {
    return null;
  }
  const match = text.match(/^(\d{1,3})\s*[x×]?\s+(.+)$/i) ?? text.match(/^(\d{1,3})[x×](.+)$/i);
  const quantity = match ? Math.min(Math.max(Number(match[1]), 1), MAX_ROLE_QUANTITY) : 1;
  const name = (match?.[2] ?? text).trim();
  if (!name) {
    return null;
  }
  const preset = EVENT_CREW_PRESETS.find(p => p.aliases.includes(name.toLowerCase()));
  const title = preset ? preset.title : name.charAt(0).toUpperCase() + name.slice(1);
  return {
    role_title: title.slice(0, MAX_EVENT_ROLE_TITLE),
    quantity,
    engagement_type: preset ? preset.engagement : 'paid',
    can_check_in: preset?.checksIn === true,
  };
}

/** Parse a list of crew lines, merging repeats of the same role. */
export function parseCrewRoles(raw: unknown): ParsedCrewRole[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: ParsedCrewRole[] = [];
  for (const item of raw) {
    const role = typeof item === 'string' ? parseCrewRole(item) : null;
    if (!role) {
      continue;
    }
    const existing = out.find(r => r.role_title.toLowerCase() === role.role_title.toLowerCase());
    if (existing) {
      existing.quantity = Math.min(existing.quantity + role.quantity, MAX_ROLE_QUANTITY);
    } else if (out.length < MAX_EVENT_ROLES) {
      out.push(role);
    }
  }
  return out;
}
