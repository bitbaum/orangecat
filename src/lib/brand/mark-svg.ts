import type { MarkDefinition, MarkShape } from '@/config/marks/types';

/**
 * A mark as standalone `<svg>` markup — for the static assets and anything
 * else that cannot render React (the asset generator, the sync test).
 * React surfaces render <Mark>, which draws the same shapes.
 */

/**
 * How the brand's icons look: the mark in near-white on a near-black rounded
 * square. The generator writes the static assets with exactly these values
 * and the sync test recomputes them, so an asset that drifts fails CI.
 */
export const ICON_STYLE = {
  ink: '#ededed',
  canvas: '#0a0a0a',
  /** Corner radius as a fraction of the tile's side. */
  radius: 0.22,
  /** How much of the tile the mark fills. */
  inset: 0.84,
  /** Maskable PWA icons must keep the mark inside the centre safe zone. */
  maskableInset: 0.68,
} as const;

export interface MarkSvgOptions {
  /** Rendered width and height. Omitted, the svg has no size and scales to its box. */
  size?: number;
  /** Paint for every shape. `currentColor` by default. */
  color?: string;
  /** A square tile of this colour behind the mark (icons). */
  background?: string;
  /** Tile corner radius as a fraction of its side. */
  radius?: number;
  /** Scale of the mark inside its box, 1 = edge to edge. */
  inset?: number;
}

const n = (value: number) => String(Number(value.toFixed(3)));

/** Paint attributes for one shape, in SVG attribute syntax. */
export function shapeAttributes(mark: MarkDefinition, shape: MarkShape, color: string): string {
  const attrs: string[] = [`d="${shape.d}"`];
  if (shape.paint === 'stroke') {
    attrs.push(
      'fill="none"',
      `stroke="${color}"`,
      `stroke-width="${n(shape.strokeWidth ?? mark.strokeWidth)}"`
    );
    if (shape.linecap) attrs.push(`stroke-linecap="${shape.linecap}"`);
    if (shape.linejoin) attrs.push(`stroke-linejoin="${shape.linejoin}"`);
  } else {
    attrs.push(`fill="${color}"`);
    if (shape.fillRule) attrs.push(`fill-rule="${shape.fillRule}"`);
  }
  if (shape.opacity !== undefined && shape.opacity < 1) attrs.push(`opacity="${n(shape.opacity)}"`);
  return attrs.join(' ');
}

/**
 * The box a mark is drawn in. Icons need a square tile, so a wide or tall
 * mark's viewBox is grown around its centre until it is square — the mark is
 * never stretched.
 */
export function squareViewBox(
  viewBox: MarkDefinition['viewBox']
): [number, number, number, number] {
  const [x, y, w, h] = viewBox;
  const side = Math.max(w, h);
  return [x - (side - w) / 2, y - (side - h) / 2, side, side];
}

export function markSvg(mark: MarkDefinition, options: MarkSvgOptions = {}): string {
  const color = options.color ?? 'currentColor';
  const inset = options.inset ?? 1;
  const square = options.background !== undefined || inset !== 1;
  const [x, y, w, h] = square ? squareViewBox(mark.viewBox) : mark.viewBox;

  const size =
    options.size === undefined ? '' : ` width="${options.size}" height="${options.size}"`;
  const background =
    options.background === undefined
      ? ''
      : `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n((options.radius ?? ICON_STYLE.radius) * w)}" fill="${options.background}"/>`;

  const cx = x + w / 2;
  const cy = y + h / 2;
  const transform =
    inset === 1
      ? ''
      : ` transform="translate(${n(cx)} ${n(cy)}) scale(${n(inset)}) translate(${n(-cx)} ${n(-cy)})"`;

  const shapes = mark.shapes
    .map(shape => `<path ${shapeAttributes(mark, shape, color)}/>`)
    .join('');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg"${size} viewBox="${n(x)} ${n(y)} ${n(w)} ${n(h)}">` +
    background +
    `<g${transform}>${shapes}</g>` +
    `</svg>`
  );
}

/** The brand icon tile, exactly as the static assets carry it. */
export function iconSvg(mark: MarkDefinition, options: { maskable?: boolean } = {}): string {
  return markSvg(mark, {
    color: ICON_STYLE.ink,
    background: ICON_STYLE.canvas,
    radius: options.maskable ? 0 : ICON_STYLE.radius,
    inset: options.maskable ? ICON_STYLE.maskableInset : ICON_STYLE.inset,
  });
}
