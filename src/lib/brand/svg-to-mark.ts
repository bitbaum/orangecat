import type { MarkDefinition, MarkShape } from '@/config/marks/types';

/**
 * Turn an SVG file — whatever a designer exported — into a mark.
 *
 * A mark is one colour: every shape is either stroked or filled with whatever
 * colour the surface hands it. So this keeps the geometry and how each shape
 * is painted (stroke or fill, width, caps, joins, fill rule, opacity) and lets
 * the colours go, warning when there was more than one.
 *
 * Supported: path, circle, ellipse, rect, line, polyline, polygon; paint set
 * by attributes, `style="…"`, or simple `.class` rules in a <style> block;
 * inheritance through <g>. A full-size background rectangle is dropped, since
 * every surface supplies its own.
 *
 * Refused, with a message that says what to do: transforms, clip paths,
 * masks, <use>, <text>, <image>. Each would need a real SVG engine to flatten
 * correctly, and a mark that silently came out wrong is worse than a clear
 * "flatten this in your editor first".
 */

export class MarkImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MarkImportError';
  }
}

export type ImportedGeometry = Pick<MarkDefinition, 'viewBox' | 'strokeWidth' | 'shapes'>;

export interface ImportResult extends ImportedGeometry {
  warnings: string[];
}

type Style = Record<string, string>;

const INHERITED = [
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'fill-rule',
  'fill-opacity',
  'stroke-opacity',
  'visibility',
] as const;

const PAINT_PROPS = [...INHERITED, 'opacity', 'display', 'transform', 'clip-path', 'mask'] as const;

const SHAPES = new Set(['path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon']);
const REFUSED: Record<string, string> = {
  use: '<use> references another element; expand it ("Unlink clone" / "Detach symbol") first',
  text: '<text> is a font, not a shape; convert text to outlines first',
  image: '<image> is a picture, not a shape; a mark must be vector paths',
  foreignObject: '<foreignObject> cannot be drawn as a mark',
};

const num = (value: string | undefined, fallback = 0): number => {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const f = (value: number) => String(Number(value.toFixed(3)));

function parseAttributes(source: string): Style {
  const attrs: Style = {};
  const re = /([^\s=/]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  for (let m = re.exec(source); m; m = re.exec(source)) {
    attrs[m[1]] = m[2] ?? m[3] ?? '';
  }
  return attrs;
}

function parseDeclarations(source: string): Style {
  const style: Style = {};
  for (const part of source.split(';')) {
    const i = part.indexOf(':');
    if (i > 0) {
      style[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
    }
  }
  return style;
}

function parseClassRules(css: string, warnings: string[]): Map<string, Style> {
  const rules = new Map<string, Style>();
  const re = /([^{}]+)\{([^}]*)\}/g;
  for (let m = re.exec(css); m; m = re.exec(css)) {
    const declarations = parseDeclarations(m[2]);
    for (const raw of m[1].split(',')) {
      const selector = raw.trim();
      if (/^\.[\w-]+$/.test(selector)) {
        rules.set(selector.slice(1), { ...rules.get(selector.slice(1)), ...declarations });
      } else if (selector) {
        warnings.push(`ignored the CSS rule "${selector}" — only simple .class rules are read`);
      }
    }
  }
  return rules;
}

/** Presentation attributes < class rules < inline style, as CSS orders them. */
function ownStyle(attrs: Style, classes: Map<string, Style>): Style {
  const style: Style = {};
  for (const prop of PAINT_PROPS) {
    if (attrs[prop] !== undefined) {
      style[prop] = attrs[prop];
    }
  }
  for (const name of (attrs.class ?? '').split(/\s+/).filter(Boolean)) {
    Object.assign(style, classes.get(name));
  }
  if (attrs.style) {
    Object.assign(style, parseDeclarations(attrs.style));
  }
  return style;
}

function points(value: string): number[][] {
  const values = value
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(v => Number.parseFloat(v));
  const pairs: number[][] = [];
  for (let i = 0; i + 1 < values.length; i += 2) {
    pairs.push([values[i], values[i + 1]]);
  }
  return pairs;
}

function shapePath(tag: string, a: Style): string | null {
  switch (tag) {
    case 'path':
      return a.d?.trim() || null;
    case 'circle':
    case 'ellipse': {
      const cx = num(a.cx);
      const cy = num(a.cy);
      const rx = tag === 'circle' ? num(a.r) : num(a.rx);
      const ry = tag === 'circle' ? num(a.r) : num(a.ry);
      if (rx <= 0 || ry <= 0) {
        return null;
      }
      return (
        `M${f(cx - rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 1 0 ${f(cx + rx)} ${f(cy)}` +
        `A${f(rx)} ${f(ry)} 0 1 0 ${f(cx - rx)} ${f(cy)}Z`
      );
    }
    case 'rect': {
      const x = num(a.x);
      const y = num(a.y);
      const w = num(a.width);
      const h = num(a.height);
      if (w <= 0 || h <= 0) {
        return null;
      }
      let rx = a.rx !== undefined ? num(a.rx) : num(a.ry);
      let ry = a.ry !== undefined ? num(a.ry) : rx;
      rx = Math.min(rx, w / 2);
      ry = Math.min(ry, h / 2);
      if (rx <= 0 || ry <= 0) {
        return `M${f(x)} ${f(y)}H${f(x + w)}V${f(y + h)}H${f(x)}Z`;
      }
      const arc = (ex: number, ey: number) => `A${f(rx)} ${f(ry)} 0 0 1 ${f(ex)} ${f(ey)}`;
      return (
        `M${f(x + rx)} ${f(y)}H${f(x + w - rx)}${arc(x + w, y + ry)}V${f(y + h - ry)}` +
        `${arc(x + w - rx, y + h)}H${f(x + rx)}${arc(x, y + h - ry)}V${f(y + ry)}${arc(x + rx, y)}Z`
      );
    }
    case 'line':
      return `M${f(num(a.x1))} ${f(num(a.y1))}L${f(num(a.x2))} ${f(num(a.y2))}`;
    case 'polyline':
    case 'polygon': {
      const pts = points(a.points ?? '');
      if (pts.length < 2) {
        return null;
      }
      const d = pts.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${f(px)} ${f(py)}`).join('');
      return tag === 'polygon' ? `${d}Z` : d;
    }
    default:
      return null;
  }
}

/**
 * What SVG path data may contain: commands, numbers, separators. A mark's
 * path is written verbatim into public files (favicon.svg, the share cards),
 * so anything else — a quote, an angle bracket — is refused, never escaped.
 */
const PATH_DATA = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\-\s]+$/;

const isPaint = (value: string | undefined) =>
  value !== undefined && value !== 'none' && value !== 'transparent';

function readViewBox(attrs: Style): [number, number, number, number] {
  if (attrs.viewBox) {
    const parts = attrs.viewBox
      .trim()
      .split(/[\s,]+/)
      .map(v => Number.parseFloat(v));
    if (parts.length === 4 && parts.every(Number.isFinite) && parts[2] > 0 && parts[3] > 0) {
      return [parts[0], parts[1], parts[2], parts[3]];
    }
  }
  const w = num(attrs.width);
  const h = num(attrs.height);
  if (w > 0 && h > 0) {
    return [0, 0, w, h];
  }
  throw new MarkImportError('the <svg> has no usable viewBox, width or height');
}

/** Elements whose contents are never drawn: skipped whole, children and all. */
const SKIPPED_BLOCKS = ['defs', 'title', 'desc', 'metadata', 'style'];

/**
 * The SVG with comments, processing instructions, doctypes, CDATA and the
 * never-drawn blocks removed — in ONE forward scan that skips by position and
 * never re-reads what it has emitted. That matters: regex removal leaves a
 * fresh `<!--` behind for input like `<!<!--x-->--`, however often it runs.
 * Safety does not rest on this either way — every path is checked against
 * PATH_DATA before it can reach a file.
 */
export function withoutIgnoredMarkup(svg: string): string {
  const lower = svg.toLowerCase();
  const skipPast = (from: number, terminator: string) => {
    const end = lower.indexOf(terminator, from);
    return end < 0 ? svg.length : end + terminator.length;
  };

  let out = '';
  let i = 0;
  while (i < svg.length) {
    const lt = svg.indexOf('<', i);
    if (lt < 0) {
      out += svg.slice(i);
      break;
    }
    out += svg.slice(i, lt);

    if (lower.startsWith('<!--', lt)) {
      i = skipPast(lt + 4, '-->');
    } else if (lower.startsWith('<![cdata[', lt)) {
      i = skipPast(lt + 9, ']]>');
    } else if (lower.startsWith('<?', lt)) {
      i = skipPast(lt + 2, '?>');
    } else if (lower.startsWith('<!', lt)) {
      i = skipPast(lt + 2, '>');
    } else {
      const block = SKIPPED_BLOCKS.find(
        name =>
          lower.startsWith(`<${name}`, lt) && !/[\w:.-]/.test(lower.charAt(lt + 1 + name.length))
      );
      if (block) {
        const tagEnd = skipPast(lt, '>');
        i = svg.charAt(tagEnd - 2) === '/' ? tagEnd : skipPast(skipPast(tagEnd, `</${block}`), '>');
      } else {
        out += '<';
        i = lt + 1;
      }
    }
  }
  return out;
}

export function svgToMark(svg: string): ImportResult {
  const warnings: string[] = [];

  const css = Array.from(svg.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi))
    .map(m => m[1].split('<![CDATA[').join('').split(']]>').join(''))
    .join('\n');
  const classes = parseClassRules(css, warnings);

  const cleaned = withoutIgnoredMarkup(svg);

  const tagRe =
    /<(\/?)([a-zA-Z][\w:.-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*(\/?)>/g;

  const stack: Array<{ tag: string; style: Style; opacity: number }> = [];
  let viewBox: [number, number, number, number] | null = null;
  const shapes: MarkShape[] = [];
  const colours = new Set<string>();

  for (let m = tagRe.exec(cleaned); m; m = tagRe.exec(cleaned)) {
    const [, closing, rawTag, attrSource, selfClosing] = m;
    const tag = rawTag.replace(/^svg:/, '');

    if (closing) {
      const i = stack.map(e => e.tag).lastIndexOf(tag);
      if (i >= 0) {
        stack.length = i;
      }
      continue;
    }

    if (REFUSED[tag]) {
      throw new MarkImportError(REFUSED[tag]);
    }

    const attrs = parseAttributes(attrSource);
    const parent = stack[stack.length - 1];
    const own = ownStyle(attrs, classes);

    if (own.transform && own.transform.trim() !== '') {
      throw new MarkImportError(
        `<${tag}> has transform="${own.transform}". Flatten transforms in your editor first ` +
          '(Inkscape: Path → Object to Path, then save as Plain SVG; Figma and Illustrator flatten on export).'
      );
    }
    for (const unsupported of ['clip-path', 'mask'] as const) {
      if (own[unsupported] && own[unsupported] !== 'none') {
        throw new MarkImportError(
          `<${tag}> uses ${unsupported}. Apply it in your editor first (Object → Clip/Mask → Release, or Boolean → Intersect).`
        );
      }
    }

    const style: Style = {};
    for (const prop of INHERITED) {
      const value = own[prop] ?? parent?.style[prop];
      if (value !== undefined) {
        style[prop] = value;
      }
    }
    const opacity = (parent?.opacity ?? 1) * num(own.opacity, 1);
    const hidden = own.display === 'none' || style.visibility === 'hidden';

    if (tag === 'svg' && !viewBox) {
      viewBox = readViewBox(attrs);
    }

    if (SHAPES.has(tag) && !hidden) {
      if (!viewBox) {
        throw new MarkImportError(`found <${tag}> outside an <svg> element`);
      }
      const d = shapePath(tag, attrs);
      if (d && !PATH_DATA.test(d)) {
        throw new MarkImportError(
          `<${tag}> has path data that is not path data (only commands, numbers and separators are allowed)`
        );
      }
      if (d) {
        const fill = style.fill ?? 'black';
        const stroke = style.stroke;

        const isBackground =
          tag === 'rect' &&
          isPaint(fill) &&
          Math.abs(num(attrs.x) - viewBox[0]) <= viewBox[2] * 0.005 &&
          Math.abs(num(attrs.y) - viewBox[1]) <= viewBox[3] * 0.005 &&
          num(attrs.width) >= viewBox[2] * 0.99 &&
          num(attrs.height) >= viewBox[3] * 0.99;

        if (isBackground) {
          warnings.push(
            'dropped a full-size background rectangle — every surface supplies its own'
          );
        } else {
          // A <line> has no inside, so SVG never fills it, whatever `fill` says.
          if (tag !== 'line' && isPaint(fill)) {
            if (fill.startsWith('url(')) {
              warnings.push(`a gradient or pattern fill became solid`);
            }
            colours.add(fill.toLowerCase());
            const shape: MarkShape = { paint: 'fill', d };
            if (style['fill-rule'] === 'evenodd') {
              shape.fillRule = 'evenodd';
            }
            const o = opacity * num(style['fill-opacity'], 1);
            if (o < 1) {
              shape.opacity = Number(o.toFixed(3));
            }
            shapes.push(shape);
          }
          if (stroke !== undefined && isPaint(stroke)) {
            if (stroke.startsWith('url(')) {
              warnings.push(`a gradient or pattern stroke became solid`);
            }
            colours.add(stroke.toLowerCase());
            const shape: MarkShape = {
              paint: 'stroke',
              d,
              strokeWidth: num(style['stroke-width'], 1),
            };
            const cap = style['stroke-linecap'];
            if (cap === 'butt' || cap === 'round' || cap === 'square') {
              shape.linecap = cap;
            }
            const join = style['stroke-linejoin'];
            if (join === 'miter' || join === 'round' || join === 'bevel') {
              shape.linejoin = join;
            }
            const o = opacity * num(style['stroke-opacity'], 1);
            if (o < 1) {
              shape.opacity = Number(o.toFixed(3));
            }
            shapes.push(shape);
          }
        }
      }
    } else if (
      !SHAPES.has(tag) &&
      tag !== 'svg' &&
      tag !== 'g' &&
      tag !== 'a' &&
      tag !== 'switch'
    ) {
      warnings.push(`ignored <${tag}>`);
    }

    if (!selfClosing) {
      stack.push({ tag, style, opacity });
    }
  }

  if (!viewBox) {
    throw new MarkImportError('this file has no <svg> element');
  }
  if (shapes.length === 0) {
    throw new MarkImportError('found nothing to draw in this SVG');
  }

  colours.delete('currentcolor');
  if (colours.size > 1) {
    warnings.push(
      `the SVG used ${colours.size} colours (${Array.from(colours).join(', ')}); a mark is drawn in one`
    );
  }

  // The most common stroke width becomes the mark's; shapes keep only a different one.
  const widths = new Map<number, number>();
  for (const s of shapes) {
    if (s.paint === 'stroke' && s.strokeWidth !== undefined) {
      widths.set(s.strokeWidth, (widths.get(s.strokeWidth) ?? 0) + 1);
    }
  }
  const strokeWidth =
    Array.from(widths.entries()).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 1;
  for (const s of shapes) {
    if (s.strokeWidth === strokeWidth) {
      delete s.strokeWidth;
    }
  }

  return { viewBox, strokeWidth, shapes, warnings };
}
