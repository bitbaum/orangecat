/**
 * The cat coil: one continuous stroke wound from an outer tail at the bottom
 * inward to the centre, with two ears on the outer turn — Loki's spiral
 * wearing the cat.
 *
 * The outer turn holds its radius through both ears, so the head is
 * symmetric, then sheds just enough radius to pass inside its own tail.
 * Inner turns tighten faster. It reads as a cat at a 16px favicon and as a
 * hypnotic coil at 220px.
 *
 * A generator, not a mark: src/config/marks/orangecat.ts calls it. Replacing
 * OrangeCat's mark with a drawn one (`pnpm run brand:import orangecat x.svg`)
 * leaves this file untouched, ready to come back.
 */

export const CAT_COIL = {
  /** Square viewBox edge. Every coordinate below lives in this space. */
  viewBox: 100,
  /** Centre of the coil — slightly below the middle; the ears need headroom. */
  cx: 50,
  cy: 53,
  /** Full turns. Dense enough to pull the eye, sparse enough for 16px. */
  turns: 2.85,
  /** Radius of the outer turn (ears are added on top of it). */
  outerRadius: 37,
  /** Radius where the coil ends, at the centre. */
  innerRadius: 1.5,
  /** Radius the outer turn gives up to pass inside its own tail. */
  firstTurnDrop: 11,
  /** Fraction of the outer turn held at full radius — through both ears. */
  holdFraction: 0.7,
  /** Ear centres in degrees (0° right, 90° bottom, 270° top). */
  earAngles: [225, 315] as readonly [number, number],
  /** Angular width of each ear, degrees. */
  earSpan: 32,
  /** Height of each ear above the outer turn, viewBox units. */
  earHeight: 24,
  /** Where the tail starts, degrees. Bottom, so it reads as a tail. */
  startAngle: 90,
  /** Stroke width, viewBox units. */
  strokeWidth: 6,
  /** Polyline samples per turn. */
  samplesPerTurn: 120,
} as const;

export type CatCoilParams = typeof CAT_COIL;

const TAU = 2 * Math.PI;

/** Triangular ear profile: 1 at the ear's centre angle, 0 at its edges. */
function earBump(angleDeg: number, centerDeg: number, spanDeg: number): number {
  const distance = Math.abs(((angleDeg - centerDeg + 540) % 360) - 180);
  const half = spanDeg / 2;
  return distance >= half ? 0 : 1 - distance / half;
}

/** The coil as an SVG path `d`, emitted outer tail → centre. Pure geometry. */
export function catCoilPathD(overrides: Partial<CatCoilParams> = {}): string {
  const m = { ...CAT_COIL, ...overrides };
  const thetaMax = m.turns * TAU;
  const steps = Math.max(2, Math.round(m.turns * m.samplesPerTurn));
  const innerSlope = (m.outerRadius - m.firstTurnDrop - m.innerRadius) / (thetaMax - TAU);
  const hold = m.holdFraction * TAU;

  let d = '';
  for (let i = 0; i <= steps; i++) {
    const wound = thetaMax * (i / steps);
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
    d += `${i === 0 ? 'M' : 'L'}${(m.cx + r * Math.cos(a)).toFixed(2)} ${(m.cy + r * Math.sin(a)).toFixed(2)} `;
  }
  return d.trim();
}
