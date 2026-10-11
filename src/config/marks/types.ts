/**
 * What a mark IS, as data: a viewBox and the shapes drawn in it, each either
 * stroked or filled with whatever colour the surface hands it.
 *
 * Every mark in src/config/marks/ is one of these, whether a function drew it
 * (OrangeCat's coil, Loki's coil) or a designer did and it was imported from
 * an SVG (`pnpm run brand:import <slug> <file.svg>`). Everything that shows a
 * mark — the header, the hero, share cards, favicons, the studio tiles —
 * renders this shape and knows nothing about where it came from. That is what
 * makes a mark replaceable: swap the file, and every surface follows.
 */

/** How a mark moves when a surface asks it to (`animated`). Chrome never animates. */
export type MarkMotion =
  /** Strokes draw themselves in, fills fade in, then the whole mark breathes. */
  | 'draw'
  /** A slow turn — Loki's coil. */
  | 'spin'
  /** Still, even when asked. */
  | 'none';

export interface MarkShape {
  /** SVG path data, in the mark's viewBox coordinates. */
  d: string;
  /** Stroked with the current colour, or filled with it. Never both: import splits such a shape in two. */
  paint: 'stroke' | 'fill';
  /** Stroke width in viewBox units (stroke shapes). Falls back to the mark's. */
  strokeWidth?: number;
  linecap?: 'butt' | 'round' | 'square';
  linejoin?: 'miter' | 'round' | 'bevel';
  /** Fill rule (fill shapes) — `evenodd` is how most logos cut their holes. */
  fillRule?: 'nonzero' | 'evenodd';
  /** 0–1. A mark is one colour; opacity is how it shades. */
  opacity?: number;
}

export interface MarkDefinition {
  /** The fleet slug this mark belongs to — the file name, and the key in MARKS. */
  slug: string;
  /** Display name, for alt text and titles. */
  name: string;
  /** `[minX, minY, width, height]`, exactly as the SVG's viewBox attribute. */
  viewBox: readonly [number, number, number, number];
  /** Default stroke width for stroke shapes that do not set their own. */
  strokeWidth: number;
  motion: MarkMotion;
  /** Where the geometry comes from — shown in docs and the file's header, never on a page. */
  source: string;
  shapes: readonly MarkShape[];
}
