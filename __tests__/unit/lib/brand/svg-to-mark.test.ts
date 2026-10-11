/**
 * Importing a mark from an SVG, as `pnpm run brand:import` does.
 *
 * The promise is "drop in the designer's file and every surface follows", so
 * the importer has to read the shapes real exports use, keep how each is
 * painted, and refuse — loudly, with a way forward — anything it would get
 * wrong rather than produce a mark that is quietly off.
 */

import { MarkImportError, svgToMark, withoutIgnoredMarkup } from '@/lib/brand/svg-to-mark';
import { markIdentifier, markModuleSource, marksIndexSource } from '@/lib/brand/mark-sources';
import { markSvg, squareViewBox } from '@/lib/brand/mark-svg';
import type { MarkDefinition } from '@/config/marks/types';

const svg = (body: string, attrs = 'viewBox="0 0 24 24"') =>
  `<?xml version="1.0"?><!-- exported --><svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`;

describe('svgToMark', () => {
  it('reads a stroked icon the way lucide ships it', () => {
    const result = svgToMark(
      svg(
        '<path d="M12 3v18"/><path d="M7 21h10"/>',
        'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'
      )
    );
    expect(result.viewBox).toEqual([0, 0, 24, 24]);
    expect(result.strokeWidth).toBe(2);
    expect(result.shapes).toEqual([
      { paint: 'stroke', d: 'M12 3v18', linecap: 'round', linejoin: 'round' },
      { paint: 'stroke', d: 'M7 21h10', linecap: 'round', linejoin: 'round' },
    ]);
    expect(result.warnings).toEqual([]);
  });

  it('treats an unpainted shape as filled, as SVG does', () => {
    const { shapes } = svgToMark(svg('<path d="M0 0h10v10z" fill-rule="evenodd"/>'));
    expect(shapes).toEqual([{ paint: 'fill', d: 'M0 0h10v10z', fillRule: 'evenodd' }]);
  });

  it('converts circles, rects, lines and polygons to paths', () => {
    const { shapes } = svgToMark(
      svg(
        '<circle cx="12" cy="12" r="4"/><rect x="2" y="2" width="4" height="6"/>' +
          '<line x1="0" y1="0" x2="5" y2="5" stroke="#000"/><polygon points="1,1 3,1 2,3"/>'
      )
    );
    expect(shapes.map(s => s.d)).toEqual([
      'M8 12A4 4 0 1 0 16 12A4 4 0 1 0 8 12Z',
      'M2 2H6V8H2Z',
      'M0 0L5 5',
      'M1 1L3 1L2 3Z',
    ]);
    expect(shapes.map(s => s.paint)).toEqual(['fill', 'fill', 'stroke', 'fill']);
  });

  it('inherits paint through groups, with inline style and class rules on top', () => {
    const { shapes } = svgToMark(
      svg(
        '<style>.thin{stroke-width:1.5}</style>' +
          '<g fill="none" stroke="#111" stroke-width="3">' +
          '<path d="M1 1h2"/><path class="thin" d="M2 2h2"/><path style="stroke-width:4" d="M3 3h2"/>' +
          '</g>'
      )
    );
    // Each width appears once, so the narrowest becomes the mark's and that
    // shape stops carrying its own.
    expect(shapes.map(s => [s.paint, s.strokeWidth])).toEqual([
      ['stroke', 3],
      ['stroke', undefined],
      ['stroke', 4],
    ]);
  });

  it('splits a shape that is both filled and stroked into two', () => {
    const { shapes } = svgToMark(svg('<path d="M0 0h5v5z" fill="#000" stroke="#000"/>'));
    expect(shapes.map(s => s.paint)).toEqual(['fill', 'stroke']);
  });

  it('drops a full-size background rectangle and says so', () => {
    const result = svgToMark(
      svg(
        '<rect width="100" height="100" fill="#0a0a0a"/><path d="M10 10h80"/>',
        'viewBox="0 0 100 100"'
      )
    );
    expect(result.shapes).toHaveLength(1);
    expect(result.warnings.join(' ')).toMatch(/background/);
  });

  it('carries opacity and warns when colours are flattened', () => {
    const result = svgToMark(
      svg('<g opacity="0.5"><path d="M0 0h1" fill="#f00"/></g><path d="M1 1h1" fill="#00f"/>')
    );
    expect(result.shapes[0].opacity).toBe(0.5);
    expect(result.warnings.join(' ')).toMatch(/2 colours/);
  });

  it('falls back to width and height when there is no viewBox', () => {
    expect(svgToMark(svg('<path d="M0 0h1"/>', 'width="48px" height="32"')).viewBox).toEqual([
      0, 0, 48, 32,
    ]);
  });

  it.each([
    ['a transform', '<g transform="translate(2 2)"><path d="M0 0h1"/></g>', /Flatten transforms/],
    ['a clip path', '<path d="M0 0h1" clip-path="url(#c)"/>', /clip-path/],
    ['text', '<text>Hi</text>', /outlines/],
    ['a <use>', '<use href="#a"/>', /expand it/],
    ['nothing to draw', '<g></g>', /nothing to draw/],
    ['markup smuggled into path data', `<path d='M0 0"/><script>x</script>'/>`, /not path data/],
  ])('refuses %s with a way forward', (_label, body, message) => {
    expect(() => svgToMark(svg(body))).toThrow(MarkImportError);
    expect(() => svgToMark(svg(body))).toThrow(message);
  });

  it('never imports what a comment or a never-drawn block holds', () => {
    const { shapes } = svgToMark(
      svg(
        '<!-- <path d="M9 9h1"/> --><defs><path d="M8 8h1"/></defs><title>T</title>' +
          '<metadata/><path d="M0 0h1"/>'
      )
    );
    expect(shapes).toEqual([{ paint: 'fill', d: 'M0 0h1' }]);
  });

  it('reads tangled comments in one pass and still emits only path data', () => {
    // Regex removal leaves a fresh "<!--" behind here, however often it runs.
    const { shapes } = svgToMark(svg('<!<!--x-->-- <path d="M9 9h1"/> --><path d="M0 0h1"/>'));
    for (const shape of shapes) {
      expect(shape.d).toMatch(/^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\-\s]+$/);
    }
    expect(withoutIgnoredMarkup('a<!--b-->c<![CDATA[d]]>e<?f?>g<!DOCTYPE h>i')).toBe('acegi');
  });
});

describe('the sources the importer writes', () => {
  const mark: MarkDefinition = {
    slug: 'geo-kit',
    name: "Geo's kit",
    source: 'imported — logo.svg',
    viewBox: [0, 0, 24, 24],
    strokeWidth: 2,
    motion: 'draw',
    shapes: [{ paint: 'stroke', d: 'M0 0h1', linecap: 'round' }],
  };

  it('names identifiers safely', () => {
    expect(markIdentifier('geo-kit')).toBe('geoKit');
    expect(markIdentifier('3d-print')).toBe('_3dPrint');
  });

  it('writes a mark module that carries the geometry and how to replace it', () => {
    const source = markModuleSource(mark, { file: 'logo.svg', date: '2026-10-11' });
    expect(source).toContain("slug: 'geo-kit'");
    expect(source).toContain("name: 'Geo\\'s kit'");
    expect(source).toContain("d: 'M0 0h1'");
    expect(source).toContain('pnpm run brand:import geo-kit path/to/new-mark.svg');
    expect(source).toContain('export default mark;');
  });

  it('writes an index that imports every mark, sorted, quoting keys that need it', () => {
    const source = marksIndexSource(['solon', 'geo-kit', 'loki']);
    expect(source.indexOf("from './geo-kit'")).toBeLessThan(source.indexOf("from './loki'"));
    expect(source).toContain("import geoKit from './geo-kit';");
    expect(source).toContain("  'geo-kit': geoKit,");
    expect(source).toContain('  loki,');
    expect(source).toContain('satisfies Record<string, MarkDefinition>');
  });
});

describe('markSvg', () => {
  const wide: MarkDefinition = {
    slug: 'wide',
    name: 'Wide',
    source: 'test',
    viewBox: [0, 0, 40, 20],
    strokeWidth: 2,
    motion: 'none',
    shapes: [{ paint: 'fill', d: 'M0 0h40v20z' }],
  };

  it('grows a wide mark into a square tile instead of stretching it', () => {
    expect(squareViewBox(wide.viewBox)).toEqual([0, -10, 40, 40]);
    expect(markSvg(wide, { background: '#000' })).toContain('viewBox="0 -10 40 40"');
  });

  it('keeps the mark’s own box when no tile is asked for', () => {
    expect(markSvg(wide)).toContain('viewBox="0 0 40 20"');
    expect(markSvg(wide)).toContain('fill="currentColor"');
  });
});
