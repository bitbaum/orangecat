/**
 * The OrangeCat mark — a coil that is a cat.
 *
 * One continuous stroke, wound from an outer tail at the bottom inward to
 * the centre, with two ears on the outer turn. It is Loki's coil with ears:
 * the two products share a geometric language (one stroke, one colour, a
 * spiral that pulls the eye in) and differ where they differ in purpose.
 * Loki's spiral falls into infinity; this one wears the cat on its outer
 * turn and holds that turn at near-constant radius so the two ears sit
 * level. It reads as a cat at a 16px favicon and as a hypnotic coil at
 * 220px in the hero.
 *
 * SSOT. Every rendered asset — the in-app BrandMark, the share cards
 * (src/lib/og/branding.tsx), public/favicon.svg, public/images/
 * orange-cat-logo.svg, favicon.ico and the PWA icons — derives from
 * `catCoilPathD()` here. Before this file there were three marks in
 * production: a cat face in the header, a "window with ears" on share cards,
 * and a fav.farm HTML error page where favicon.ico should have been. Never
 * hand-draw the geometry anywhere else; regenerate the static assets with
 * `pnpm run generate:brand`, and `__tests__/unit/config/brand-mark.test.ts`
 * fails when they drift.
 */

export const BRAND_MARK = {
  /** Square viewBox edge. Every coordinate below lives in this space. */
  viewBox: 100,
  /** Centre of the coil. Slightly below the middle: the ears need headroom. */
  cx: 50,
  cy: 53,
  /** Full turns of the coil. Dense enough to pull the eye, sparse enough for 16px. */
  turns: 2.85,
  /** Radius of the outer turn (ears are added on top of it). */
  outerRadius: 37,
  /** Radius where the coil ends, at the centre. */
  innerRadius: 1.5,
  /**
   * How much radius the first turn gives up, and when. The outer turn holds
   * its radius through both ears (`holdFraction` of the turn) so the head is
   * symmetric, then sheds `firstTurnDrop` — just enough to pass inside its own
   * tail (stroke + clearance) — in the stretch after the second ear. Inner
   * turns tighten faster.
   */
  firstTurnDrop: 11,
  holdFraction: 0.7,
  /** Where the ears sit, in degrees (0° = right, 90° = bottom, 270° = top). */
  earAngles: [225, 315] as readonly [number, number],
  /** Angular width of each ear, degrees. */
  earSpan: 32,
  /** Height of each ear above the outer turn, viewBox units. */
  earHeight: 24,
  /** Where the outer tail starts, degrees. Bottom, so it reads as a tail. */
  startAngle: 90,
  /** Stroke width, viewBox units. */
  strokeWidth: 6,
  /** Polyline samples per turn. */
  samplesPerTurn: 120,
} as const;

export type BrandMarkParams = typeof BRAND_MARK;

const TAU = 2 * Math.PI;

/** Triangular ear profile: 1 at the ear's centre angle, 0 at its edges. */
function earBump(angleDeg: number, centerDeg: number, spanDeg: number): number {
  const distance = Math.abs(((angleDeg - centerDeg + 540) % 360) - 180);
  const half = spanDeg / 2;
  return distance >= half ? 0 : 1 - distance / half;
}

/**
 * The mark as an SVG path `d` string. Pure geometry — no styling — so the
 * same path is stroked with `currentColor` in React, with a hex in the share
 * cards and in the static assets.
 */
export function catCoilPathD(overrides: Partial<BrandMarkParams> = {}): string {
  const m = { ...BRAND_MARK, ...overrides };
  const thetaMax = m.turns * TAU;
  const steps = Math.max(2, Math.round(m.turns * m.samplesPerTurn));
  const innerSlope = (m.outerRadius - m.firstTurnDrop - m.innerRadius) / (thetaMax - TAU);

  let d = '';
  for (let i = 0; i <= steps; i++) {
    // Angle travelled from the outer tail; the path is emitted outer → inner.
    const wound = thetaMax * (i / steps);
    const hold = m.holdFraction * TAU;
    let r: number;
    if (wound <= hold) {
      r = m.outerRadius;
    } else if (wound <= TAU) {
      r = m.outerRadius - m.firstTurnDrop * ((wound - hold) / (TAU - hold));
    } else {
      r = m.outerRadius - m.firstTurnDrop - innerSlope * (wound - TAU);
    }
    const angleDeg = (((m.startAngle + (wound * 180) / Math.PI) % 360) + 360) % 360;
    if (wound <= TAU) {
      for (const ear of m.earAngles) {
        r += earBump(angleDeg, ear, m.earSpan) * m.earHeight;
      }
    }
    const a = (angleDeg * Math.PI) / 180;
    const x = m.cx + r * Math.cos(a);
    const y = m.cy + r * Math.sin(a);
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return d.trim();
}

export interface BrandMarkSvgOptions {
  /** Rendered width/height. Defaults to the viewBox edge. */
  size?: number;
  /** Stroke colour. `currentColor` for inline, themable use. */
  stroke?: string;
  /** When set, a rounded square of this colour sits behind the coil (icons). */
  background?: string;
  /** Corner radius of that square, viewBox units. */
  radius?: number;
  strokeWidth?: number;
  /**
   * Scale of the coil inside the box (1 = as drawn). Icons breathe at 0.84;
   * a maskable PWA icon keeps the ears inside the safe zone at 0.7.
   */
  inset?: number;
}

/**
 * Standalone `<svg>` markup for the mark. Used by the asset generator and by
 * the sync test. In React, render `catCoilPathD()` inside JSX instead so the
 * stroke follows `currentColor`.
 */
export function brandMarkSvg(options: BrandMarkSvgOptions = {}): string {
  const vb = BRAND_MARK.viewBox;
  const size = options.size ?? vb;
  const stroke = options.stroke ?? 'currentColor';
  const strokeWidth = options.strokeWidth ?? BRAND_MARK.strokeWidth;
  const inset = options.inset ?? 1;
  const background = options.background
    ? `<rect width="${vb}" height="${vb}" rx="${options.radius ?? 22}" fill="${options.background}"/>`
    : '';
  const transform =
    inset === 1
      ? ''
      : ` transform="translate(${(vb / 2).toFixed(2)} ${(vb / 2).toFixed(2)}) scale(${inset}) translate(${(-vb / 2).toFixed(2)} ${(-vb / 2).toFixed(2)})"`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${vb} ${vb}">` +
    background +
    `<path d="${catCoilPathD()}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" ` +
    `stroke-linecap="round" stroke-linejoin="round"${transform}/>` +
    `</svg>`
  );
}
