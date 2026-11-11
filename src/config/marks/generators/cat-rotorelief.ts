/**
 * The cat rotorelief: a cat's head whose face is one of Duchamp's discs.
 * Closed rings, each a little off centre and thinner toward the middle, sit
 * in a round hole in the head. Still, it is an eye; turned (the rings alone,
 * about their own centre — the head never moves), the eye reads as a tunnel
 * that breathes. Loki is the coil that keeps building; the Cat is the ring
 * that holds still at its centre.
 *
 * Two shapes, both filled evenodd: the head with its face cut out, and the
 * rings. A generator, not a mark: src/config/marks/orangecat.ts calls it.
 */

import { circlePathD } from './rotorelief-coil';

export const CAT_ROTORELIEF = {
  /** Square viewBox edge. Every coordinate below lives in this space. */
  viewBox: 100,
  /** Centre of the head — below the middle; the ears need headroom. */
  cx: 50,
  cy: 57,
  /** Head radius. */
  headRadius: 38,
  /** Ears: tip, and where each ear's two edges leave the head, in degrees on
   *  the head circle (0° right, 90° bottom, 270° top). Left ear; the right one
   *  mirrors it. */
  earTip: [21, 8] as readonly [number, number],
  earFrom: 196,
  earTo: 252,
  /** How round the ear tip is, in viewBox units along each edge. */
  earRound: 4,
  /** The face: a hole of this share of the head, filled by the rings. */
  faceShare: 0.8,
  /** Rings in the face, outermost first; alternate rings are cut. */
  rings: 7,
  /** Perspective: >1 thins the inner rings. */
  perspective: 1.15,
  /** How far the innermost ring drifts off centre. Turning makes it depth. */
  depth: 8,
  /** Direction of the drift (radians; up-left). */
  drift: -2.4,
};

export type CatRotoreliefParams = typeof CAT_ROTORELIEF;

const f = (n: number) => n.toFixed(2);
const RAD = Math.PI / 180;

/** The head's silhouette (one closed outline, ears included) with the face cut out. */
export function catHeadPathD(overrides: Partial<CatRotoreliefParams> = {}): string {
  const m = { ...CAT_ROTORELIEF, ...overrides };
  const at = (deg: number): [number, number] => [
    m.cx + m.headRadius * Math.cos(deg * RAD),
    m.cy + m.headRadius * Math.sin(deg * RAD),
  ];
  const mirror = ([x, y]: [number, number]): [number, number] => [2 * m.cx - x, y];
  const toward = (from: [number, number], to: [number, number], d: number): [number, number] => {
    const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
    return [from[0] + ((to[0] - from[0]) * d) / len, from[1] + ((to[1] - from[1]) * d) / len];
  };
  const tipL = m.earTip as [number, number];
  const tipR = mirror(tipL);
  const aL = at(m.earFrom); // left ear, outer foot
  const bL = at(m.earTo); // left ear, inner foot
  const bR = mirror(bL);
  const aR = mirror(aL);
  // An ear: straight up to just short of the tip, a quadratic round over it,
  // straight down.
  const ear = (foot: [number, number], tip: [number, number], back: [number, number]) => {
    const p = toward(tip, foot, m.earRound);
    const q = toward(tip, back, m.earRound);
    return `L${f(p[0])} ${f(p[1])}Q${f(tip[0])} ${f(tip[1])} ${f(q[0])} ${f(q[1])}L${f(back[0])} ${f(back[1])}`;
  };
  const r = f(m.headRadius);
  const outline =
    `M${f(aL[0])} ${f(aL[1])}` +
    ear(aL, tipL, bL) +
    `A${r} ${r} 0 0 1 ${f(bR[0])} ${f(bR[1])}` +
    ear(bR, tipR, aR) +
    `A${r} ${r} 0 1 1 ${f(aL[0])} ${f(aL[1])}Z`;
  return outline + circlePathD(m.cx, m.cy, m.headRadius * m.faceShare);
}

/** The rings that fill the face: nested, eccentric circles, outermost first,
 *  so evenodd cuts every other one. Turn them about (cx, cy), the face's
 *  centre: the drift then orbits and the head stays put. */
export function catRingsPathD(overrides: Partial<CatRotoreliefParams> = {}): string {
  const m = { ...CAT_ROTORELIEF, ...overrides };
  const R = m.headRadius * m.faceShare;
  let d = '';
  for (let k = 1; k < m.rings; k++) {
    const r = R * Math.pow(1 - k / m.rings, m.perspective);
    const off = m.depth * (1 - r / R);
    d += circlePathD(m.cx + off * Math.cos(m.drift), m.cy + off * Math.sin(m.drift), r);
  }
  return d;
}
