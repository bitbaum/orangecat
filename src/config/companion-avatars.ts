/**
 * A companion's face — SSOT.
 *
 * A companion made in a minute has no picture, and a grey circle with a letter
 * reads as "unfinished". So a companion without one gets a FACE: a shape in a
 * colour with two eyes, the way a messaging app gives every contact a
 * presence. The person picks a shape and a colour when they make one (the
 * same two rows as the sheet), or the name picks for them, the same every time.
 *
 * The face is served as SVG by /api/ai-assistants/avatar?shape=…&hue=…, so it
 * lives in `avatar_url` like any picture and renders wherever a picture does.
 * Shapes are paths in a 100×100 box; colours are hex because they are CONTENT
 * (a picture's pigment), not a design token — the same reason an uploaded
 * photo is not asked to use `bg-surface-raised`.
 */

export interface AvatarShape {
  id: string;
  /** SVG path in a 0–100 box. */
  d: string;
}

export const AVATAR_SHAPES: readonly AvatarShape[] = [
  { id: 'disc', d: 'M50 4a46 46 0 1 1 0 92a46 46 0 1 1 0-92z' },
  { id: 'hex', d: 'M30 8h40l20 34-20 50H30L10 42z' },
  {
    id: 'cloud',
    d: 'M28 80c-14 0-22-10-22-20s8-18 18-18c2-14 14-26 28-26s26 10 28 24c10 2 16 10 16 18s-8 22-22 22z',
  },
  {
    id: 'tile',
    d: 'M22 12h56a10 10 0 0 1 10 10v56a10 10 0 0 1-10 10H22a10 10 0 0 1-10-10V22a10 10 0 0 1 10-10z',
  },
  { id: 'star', d: 'M50 4l12 26 28 4-20 20 5 28-25-13-25 13 5-28L10 34l28-4z' },
  {
    id: 'clover',
    d: 'M50 6c12 0 20 8 20 18 10 0 18 8 18 20s-8 20-18 20c0 12-8 20-20 20s-20-8-20-20C20 64 12 56 12 44s8-20 18-20c0-10 8-18 20-18z',
  },
  { id: 'drop', d: 'M50 4c18 26 38 44 38 62a38 38 0 1 1-76 0C12 48 32 30 50 4z' },
  { id: 'pebble', d: 'M18 30C28 8 72 6 86 28c12 20 6 52-14 62S14 92 10 70 8 50 18 30z' },
  { id: 'wedge', d: 'M14 20c0-8 8-12 14-8l60 32c6 4 6 12 0 16L28 92c-6 4-14 0-14-8z' },
  { id: 'gem', d: 'M50 4l40 28-14 60H24L10 32z' },
  { id: 'blob', d: 'M40 8c20-8 48 6 50 30 2 20-10 30-6 44s-26 14-40 10S6 78 8 56 20 16 40 8z' },
  {
    id: 'puff',
    d: 'M50 10c6 0 10 6 16 6s12-4 18 2 2 14 4 20 8 10 6 18-10 8-14 14-6 14-14 14-10-6-16-6-12 4-18-2-2-14-4-20S4 46 6 38s10-8 14-14 6-14 14-14 10 6 16 6z',
  },
] as const;

export interface AvatarHue {
  id: string;
  /** The pigment. */
  fill: string;
}

export const AVATAR_HUES: readonly AvatarHue[] = [
  { id: 'ink', fill: '#111111' },
  { id: 'cocoa', fill: '#8B5A2B' },
  { id: 'red', fill: '#FF3B4A' },
  { id: 'orange', fill: '#FF7A1A' },
  { id: 'amber', fill: '#FFA726' },
  { id: 'green', fill: '#1CC37A' },
  { id: 'teal', fill: '#0ABAB5' },
  { id: 'blue', fill: '#1E7DFF' },
  { id: 'violet', fill: '#8E5CFF' },
  { id: 'pink', fill: '#FF2E9A' },
  { id: 'slate', fill: '#7A7A7A' },
] as const;

export const AVATAR_PATH = '/api/ai-assistants/avatar';

/** The path a chosen face is served at (relative: the app's own origin). */
export function avatarPath(shape: string, hue: string): string {
  return `${AVATAR_PATH}?shape=${encodeURIComponent(shape)}&hue=${encodeURIComponent(hue)}`;
}

/** A stable small hash of a name, so "Funes" always wears the same face. */
export function hashName(name: string): number {
  let h = 2166136261;
  for (const ch of name.normalize('NFKC').toLowerCase()) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/** The face a name picks for itself when nobody chose one. */
export function faceForName(name: string): { shape: AvatarShape; hue: AvatarHue } {
  const h = hashName(name || '?');
  return {
    shape: AVATAR_SHAPES[h % AVATAR_SHAPES.length],
    hue: AVATAR_HUES[Math.floor(h / AVATAR_SHAPES.length) % AVATAR_HUES.length],
  };
}

export function findShape(id: string | null | undefined): AvatarShape | null {
  return AVATAR_SHAPES.find(s => s.id === id) ?? null;
}

export function findHue(id: string | null | undefined): AvatarHue | null {
  return AVATAR_HUES.find(h => h.id === id) ?? null;
}

/** The face as SVG markup: the shape, and two eyes that always sit in the same place. */
export function faceSvg(shape: AvatarShape, hue: AvatarHue, size = 96): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="Companion">`,
    `<path d="${shape.d}" fill="${hue.fill}"/>`,
    `<g fill="#FFFFFF" fill-opacity="0.96">`,
    `<rect x="38" y="38" width="8" height="18" rx="4" transform="rotate(-10 42 47)"/>`,
    `<rect x="56" y="38" width="8" height="18" rx="4" transform="rotate(-10 60 47)"/>`,
    `</g></svg>`,
  ].join('');
}

/** Is this `avatar_url` one of our own faces? (So the picker can show it selected.) */
export function parseFaceUrl(
  url: string | null | undefined
): { shape: string; hue: string } | null {
  if (!url) {
    return null;
  }
  const i = url.indexOf(`${AVATAR_PATH}?`);
  if (i < 0) {
    return null;
  }
  const params = new URLSearchParams(url.slice(i + AVATAR_PATH.length + 1));
  const shape = params.get('shape');
  const hue = params.get('hue');
  return shape && hue && findShape(shape) && findHue(hue) ? { shape, hue } : null;
}
