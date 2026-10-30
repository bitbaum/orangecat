/**
 * Loki's rotorelief: an Archimedean coil cut out of a disc, its inner turns
 * drifting off centre and thinning toward the middle, after Duchamp's discs in
 * Anémic Cinéma (1926). Turned, the flat disc reads as a breathing tunnel.
 *
 * Loki's SSOT is bitbaum/loki `src/config/brand-mark.ts` (`markPathD`). The
 * defaults here mirror it and must be kept in step by hand; if Loki ever ships
 * a drawn mark instead, import its SVG with `pnpm run brand:import loki <file.svg>`
 * and this generator goes unused.
 */

export const ROTORELIEF_COIL = {
  viewBox: 100,
  discRadius: 47,
  coilShare: 0.86,
  turns: 3.2,
  depth: 10,
  perspective: 1.6,
  cut: 0.5,
  drift: -2.4,
  pupil: 2.4,
  samplesPerTurn: 120,
};

export type RotoreliefCoilParams = typeof ROTORELIEF_COIL;

const f = (n: number) => n.toFixed(2);

/** A full circle as two arcs, so it can sit inside one evenodd path. */
export function circlePathD(cx: number, cy: number, r: number): string {
  return `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
}

/** The disc with the coil and pupil cut out, as one path. Fill it evenodd. */
export function rotoreliefCoilPathD(overrides: Partial<RotoreliefCoilParams> = {}): string {
  const m = { ...ROTORELIEF_COIL, ...overrides };
  const c = m.viewBox / 2;
  const R = m.discRadius * m.coilShare;
  // Start outside the pupil so the two cuts never overlap (evenodd would
  // fill an overlap back in).
  const r0 = m.pupil + 1.6;
  const thetaMax = m.turns * 2 * Math.PI;
  const n = Math.max(8, Math.round(m.turns * m.samplesPerTurn));
  const pts: Array<[number, number]> = [];
  const widths: number[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const r = r0 + (R - r0) * Math.pow(u, m.perspective);
    // Drift changes slowly near the centre (u²), so inner turns never touch.
    const off = m.depth * (1 - u * u);
    pts.push([
      c + off * Math.cos(m.drift) + r * Math.cos(u * thetaMax),
      c + off * Math.sin(m.drift) + r * Math.sin(u * thetaMax),
    ]);
    const pitch =
      ((R - r0) * m.perspective * Math.pow(Math.max(u, 0.02), m.perspective - 1)) / m.turns;
    const tail = u > 0.9 ? Math.pow((1 - u) / 0.1, 0.6) : 1;
    widths.push(pitch * m.cut * tail * Math.min(1, u / 0.04));
  }
  const left: string[] = [];
  const right: string[] = [];
  pts.forEach(([x, y], i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n, i + 1)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const tx = (b[0] - a[0]) / len;
    const ty = (b[1] - a[1]) / len;
    const h = widths[i] / 2;
    left.push(`${f(x - ty * h)} ${f(y + tx * h)}`);
    right.push(`${f(x + ty * h)} ${f(y - tx * h)}`);
  });
  return [
    circlePathD(c, c, m.discRadius),
    `M${left.join('L')}L${right.reverse().join('L')}Z`,
    circlePathD(c + m.depth * Math.cos(m.drift), c + m.depth * Math.sin(m.drift), m.pupil),
  ].join('');
}
