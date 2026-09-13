/**
 * Studio — SSOT for making things on OrangeCat.
 *
 * The Studio is where a creation is MADE (video, music, writing, images) before
 * it is financed as a project or sold as a product. Everything that needs to
 * agree about a medium — the API's zod enum, the UI's tabs, the Cat's prompt,
 * the marketing page — reads this file, so a medium cannot exist in one place
 * and be missing in another.
 *
 * Deliberately NOT a new entity type. A creative work is already expressible in
 * the taxonomy: fund it while it is being made (project), sell it when it is
 * finished (product). What was missing was the making, and a marketing story
 * that says so.
 *
 * Created: 2026-09-13
 */

import { Film, Music, BookOpen, Image as ImageIcon, type LucideIcon } from 'lucide-react';

// ==================== MEDIUMS ====================

export const STUDIO_MEDIUMS = ['video', 'music', 'writing', 'image'] as const;

export type StudioMedium = (typeof STUDIO_MEDIUMS)[number];

/**
 * How a medium's output travels back to the browser.
 *
 * - `file` — bytes are generated, persisted to storage, and returned as a URL.
 * - `text` — the output IS the answer (a chapter, a scene, a lyric sheet).
 */
export type StudioOutputKind = 'file' | 'text';

export interface StudioMediumMeta {
  id: StudioMedium;
  /** Tab label and the word the Cat uses. */
  name: string;
  /** One line, plain: what you get out of it. */
  tagline: string;
  icon: LucideIcon;
  outputKind: StudioOutputKind;
  /** Placeholder for the first prompt — shows the expected altitude. */
  promptPlaceholder: string;
  /**
   * Placeholder for the revision box. This is the whole point of the Studio:
   * you do not need the vocabulary of the craft to change the work, you just
   * say what is wrong with it.
   */
  revisePlaceholder: string;
  /** Examples of finished work in this medium, used in marketing + guidance. */
  examples: readonly string[];
}

export const STUDIO_MEDIA: Record<StudioMedium, StudioMediumMeta> = {
  video: {
    id: 'video',
    name: 'Video',
    tagline: 'Describe a scene, get a clip you can cut into something longer.',
    icon: Film,
    outputKind: 'file',
    promptPlaceholder:
      'A fishing boat leaving a harbour before sunrise, handheld, cold blue light, no dialogue',
    revisePlaceholder: 'Make it slower and less shaky. Warmer light.',
    examples: ['Short film', 'Trailer', 'Music video', 'Explainer', 'Title sequence'],
  },
  music: {
    id: 'music',
    name: 'Music & audio',
    tagline: 'Describe how it should feel. Listen. Say what to change. Repeat.',
    icon: Music,
    outputKind: 'file',
    promptPlaceholder:
      'A slow instrumental in a minor key — upright bass, brushed drums, one trumpet, late-night and unhurried',
    revisePlaceholder: 'The middle drags. Bring the trumpet in earlier and make the ending softer.',
    examples: ['Single', 'Album', 'Score', 'Podcast theme', 'Sample pack'],
  },
  writing: {
    id: 'writing',
    name: 'Writing',
    tagline: 'Chapters, scenes, essays — drafted with you, kept in your voice.',
    icon: BookOpen,
    outputKind: 'text',
    promptPlaceholder:
      'Chapter one of a novel: a harbour town, a returning daughter, a debt nobody will name',
    revisePlaceholder: 'Cut the backstory. Start in the middle of the argument.',
    examples: ['Novel', 'Essay collection', 'Screenplay', 'Newsletter', 'Comic script'],
  },
  image: {
    id: 'image',
    name: 'Images',
    tagline: 'Covers, posters, and artwork for anything you publish.',
    icon: ImageIcon,
    outputKind: 'file',
    promptPlaceholder: 'Book cover: a lighthouse at dusk, heavy grain, two colours only',
    revisePlaceholder: 'Less busy. Drop the boat and make the sky darker.',
    examples: ['Album cover', 'Book cover', 'Poster', 'Illustration set'],
  },
};

export function isStudioMedium(value: string): value is StudioMedium {
  return (STUDIO_MEDIUMS as readonly string[]).includes(value);
}

export function getStudioMedium(medium: StudioMedium): StudioMediumMeta {
  return STUDIO_MEDIA[medium];
}

/** Mediums whose output is a file we persist; the rest return text. */
export const STUDIO_FILE_MEDIUMS = STUDIO_MEDIUMS.filter(
  m => STUDIO_MEDIA[m].outputKind === 'file'
);

// ==================== LIMITS ====================

/**
 * Shared by the API (zod) and the UI (maxLength / disabled states) so the two
 * cannot disagree and produce a bare "Invalid request".
 */
export const STUDIO_PROMPT_LIMITS = { min: 3, max: 2000 } as const;

/** A revision note is a sentence or two, not a second brief. */
export const STUDIO_REVISION_LIMITS = { min: 2, max: 600 } as const;

/** How many revisions of one piece we keep in the client's session history. */
export const STUDIO_HISTORY_MAX = 12;

/** Storage prefix for generated media, under the owner's own folder. */
export const STUDIO_STORAGE_PREFIX = 'studio';

// ==================== WHAT HAPPENS NEXT ====================

/**
 * The economic move after something exists. The Studio is not a toy: every
 * medium ends at one of these two, which is what makes "create" the same verb
 * as "earn" on this platform.
 */
export const STUDIO_NEXT_MOVES = [
  {
    id: 'finance',
    title: 'Finance it',
    body: 'Not finished yet? Publish it as a project and let people fund the work while you make it.',
    entityType: 'project',
  },
  {
    id: 'sell',
    title: 'Sell it',
    body: 'Finished? List it as a product. Payment settles in Bitcoin, straight to your wallet.',
    entityType: 'product',
  },
] as const;
