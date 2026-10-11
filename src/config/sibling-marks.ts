/**
 * The sibling products' marks, so OrangeCat can show the stack with its real
 * faces instead of three generic icons.
 *
 * Loki's mark is a dense Archimedean coil. Its SSOT is bitbaum/loki
 * `src/config/brand-mark.ts` (`BRAND_MARK` + `spiralPathD`); the parameters
 * and the winding below mirror that file and must be kept in step with it by
 * hand — it is the same choice OrangeCat's own coil makes: geometry in code,
 * never a pasted path. OrangeCat's mark is Loki's coil wearing a cat, which
 * is why the two are drawn by the same kind of function.
 *
 * Solon's mark is the scales (`Scale` from lucide), drawn by its header.
 */

export const LOKI_MARK = {
  viewBox: 100,
  turns: 3.15,
  innerRadius: 1,
  outerRadius: 43,
  strokeWidth: 6,
  samplesPerTurn: 160,
} as const;

/** Loki's coil as an SVG path `d`, wound from the outer tail inward. */
export function lokiSpiralPathD(): string {
  const m = LOKI_MARK;
  const cx = m.viewBox / 2;
  const cy = m.viewBox / 2;
  const thetaMax = m.turns * 2 * Math.PI;
  const k = (m.outerRadius - m.innerRadius) / thetaMax;
  const steps = Math.max(2, Math.round(m.turns * m.samplesPerTurn));

  let d = '';
  for (let i = 0; i <= steps; i++) {
    const theta = thetaMax * (1 - i / steps);
    const r = m.innerRadius + k * theta;
    const a = theta - Math.PI / 2;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return d.trim();
}
