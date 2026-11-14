/**
 * check:one-orange runs against a fixture tree per case, so a pattern that
 * narrows (or a scope that widens to the public sign-up button) fails here
 * before it fails quietly in CI.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCRIPT = join(process.cwd(), 'scripts/check-one-orange.mjs');

const FACES = 'src/config/companion-avatars.ts';
const faces = (...fills: string[]) =>
  `export const AVATAR_HUES: readonly AvatarHue[] = [\n${fills
    .map((fill, i) => `  { id: 'h${i}', fill: '${fill}' },`)
    .join('\n')}\n] as const;`;

function gate(file: string, line: string, facesSource: string | null = faces('#111111')) {
  const dir = mkdtempSync(join(tmpdir(), 'one-orange-'));
  const path = join(dir, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${line}\n`);
  if (facesSource !== null) {
    mkdirSync(dirname(join(dir, FACES)), { recursive: true });
    writeFileSync(join(dir, FACES), `${facesSource}\n`);
  }
  try {
    const r = spawnSync('node', [SCRIPT], { cwd: dir, encoding: 'utf8' });
    return { passed: r.status === 0, output: r.stderr + r.stdout };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const SIGNED_IN = 'src/app/(authenticated)/dashboard/page.tsx';

describe('check:one-orange', () => {
  it.each([
    ['an accent button on a signed-in page', SIGNED_IN, '<Button variant="accent">Save</Button>'],
    ['orange words', 'src/components/X.tsx', '<span className="text-accent-warm">Pro</span>'],
    ['an orange outline', 'src/components/X.tsx', "active ? 'border-accent-warm' : ''"],
    [
      'an orange focus ring',
      'src/components/X.tsx',
      '<input className="focus:ring-accent-warm/40">',
    ],
    ['an orange hover', 'src/components/X.tsx', '<h2 className="group-hover:text-accent-warm">'],
  ])('fails %s', (_, file, line) => {
    const r = gate(file, line);
    expect(r.passed).toBe(false);
    expect(r.output).toContain('rose to 1');
  });

  it.each([
    [
      'the public sign-up button',
      'src/components/layout/AuthButtons.tsx',
      '<Button variant="accent">',
    ],
    ['a primary button on a signed-in page', SIGNED_IN, '<Button variant="primary">Save</Button>'],
    [
      'the accent fill with its ink',
      'src/components/X.tsx',
      '<a className="bg-accent-warm text-on-accent">',
    ],
    ['a Bitcoin glyph', 'src/components/X.tsx', '<Bitcoin className="text-bitcoinOrange" />'],
  ])('passes %s', (_, file, line) => {
    expect(gate(file, line).passed).toBe(true);
  });

  describe('bot faces (agents#14)', () => {
    const OK = ['src/components/X.tsx', '<p>fine</p>'] as const;

    it.each([
      ['orange', '#FF7A1A'],
      ['amber', '#FFA726'],
      ['Bitcoin orange', '#f7931a'],
    ])('fails a face in %s', (_, fill) => {
      const r = gate(...OK, faces('#111111', fill));
      expect(r.passed).toBe(false);
      expect(r.output).toContain('is orange');
    });

    it('passes brown, red, the map-scale replacements and the rest of the set', () => {
      const r = gate(
        ...OK,
        faces('#8B5A2B', '#FF3B4A', '#46327E', '#365C8D', '#1CC37A', '#FF2E9A', '#7A7A7A')
      );
      expect(r.passed).toBe(true);
    });

    it('fails when the list cannot be read, instead of passing unseen', () => {
      expect(gate(...OK, null).passed).toBe(false);
      expect(gate(...OK, 'export const SOMETHING_ELSE = [];').passed).toBe(false);
    });
  });
});
