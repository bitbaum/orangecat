/**
 * A dense Archimedean coil wound from an outer tail inward — Loki's mark.
 *
 * Loki's SSOT is bitbaum/loki `src/config/brand-mark.ts` (`BRAND_MARK` +
 * `spiralPathD`). The defaults here mirror it and must be kept in step by
 * hand; if Loki ever ships a drawn mark instead, import its SVG with
 * `pnpm run brand:import loki <file.svg>` and this generator goes unused.
 */

export const ARCHIMEDEAN_COIL = {
  viewBox: 100,
  turns: 3.15,
  innerRadius: 1,
  outerRadius: 43,
  strokeWidth: 6,
  samplesPerTurn: 160,
} as const;

export type ArchimedeanCoilParams = typeof ARCHIMEDEAN_COIL;

/** The coil as an SVG path `d`, wound from the outer tail (near the top) inward. */
export function archimedeanCoilPathD(overrides: Partial<ArchimedeanCoilParams> = {}): string {
  const m = { ...ARCHIMEDEAN_COIL, ...overrides };
  const c = m.viewBox / 2;
  const thetaMax = m.turns * 2 * Math.PI;
  const k = (m.outerRadius - m.innerRadius) / thetaMax;
  const steps = Math.max(2, Math.round(m.turns * m.samplesPerTurn));

  let d = '';
  for (let i = 0; i <= steps; i++) {
    const theta = thetaMax * (1 - i / steps);
    const r = m.innerRadius + k * theta;
    const a = theta - Math.PI / 2;
    d += `${i === 0 ? 'M' : 'L'}${(c + r * Math.cos(a)).toFixed(2)} ${(c + r * Math.sin(a)).toFixed(2)} `;
  }
  return d.trim();
}
