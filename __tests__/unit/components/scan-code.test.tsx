// @vitest-environment jsdom
/**
 * Pay codes on product, service and profile pages did not scan in the dark
 * theme (production, 2026-11-12): nine of twelve QR call sites left out the
 * quiet zone, so the code's black edge met a near-black frame. Every QR now
 * goes through ScanCode, which always draws black on white with the
 * four-module quiet zone.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { ScanCode } from '@/components/ui/ScanCode';
import { QR_RENDER } from '@/config/payment-qr';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return sourceFiles(path);
    }
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe('ScanCode', () => {
  it('draws the four-module quiet zone in white around a black symbol', () => {
    const { container } = render(<ScanCode value="bitcoin:bc1qexample" size={200} />);
    const svg = container.querySelector('svg')!;
    const [, , w] = svg.getAttribute('viewBox')!.split(' ').map(Number);
    const paths = [...svg.querySelectorAll('path')];
    const background = paths.find(p => p.getAttribute('fill') === QR_RENDER.bgColor)!;
    const modules = paths.find(p => p.getAttribute('fill') === QR_RENDER.fgColor)!;

    // The background covers the whole viewBox, quiet zone included…
    expect(background.getAttribute('d')).toBe(`M0,0 h${w}v${w}H0z`);
    // …and no module is drawn inside the four-module border.
    const xs = [...modules.getAttribute('d')!.matchAll(/M(\d+) (\d+)/g)].map(m => [
      Number(m[1]),
      Number(m[2]),
    ]);
    expect(Math.min(...xs.map(([x]) => x))).toBe(QR_RENDER.quietZone);
    expect(Math.min(...xs.map(([, y]) => y))).toBe(QR_RENDER.quietZone);
  });

  it('is the only place the app draws a QR', () => {
    const src = join(process.cwd(), 'src');
    const direct = sourceFiles(src)
      .filter(f => !f.endsWith(join('components', 'ui', 'ScanCode.tsx')))
      .filter(f => /from 'qrcode\.react'/.test(readFileSync(f, 'utf8')));
    expect(direct).toEqual([]);
  });
});
