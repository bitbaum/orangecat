/**
 * `.env.example` is the contract a copy of this repo is configured from. Every
 * variable `src/` reads must be named there, with the file that reads it.
 *
 * Before this gate, 47 of them were not: a fork found the switch for GitHub
 * sign-in, embeddings, the OAuth issuer or the Loki widget only by grepping
 * `process.env` — or, more likely, never found it and shipped a copy with the
 * feature silently off. A variable may be documented commented out
 * (`# KEY=`): the contract is the NAME and where it is read, not a value.
 *
 * Dynamic reads (`process.env[name]`) are not caught here by design — they
 * are the helpers that take the name as an argument.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..');
/** Node's own, Next's own, and the prefix the dynamic helpers spell out. */
const NOT_CONFIG = new Set([
  'NODE_ENV',
  'NEXT_RUNTIME',
  'HOME',
  'PATH',
  'NEXT_PUBLIC_',
  'NEXT_PUBLIC_X',
]);

function* files(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.tsx?$/.test(name)) yield p;
  }
}

describe('.env.example covers every variable src reads', () => {
  it('names each process.env.X read in src', () => {
    const example = readFileSync(join(ROOT, '.env.example'), 'utf8');
    const named = new Set([...example.matchAll(/^#?\s*([A-Z0-9_]+)=/gm)].map(m => m[1]));
    const read = new Map<string, string>();
    for (const file of files(join(ROOT, 'src'))) {
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        // A comment that mentions a variable is not a read of it.
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
        for (const m of line.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
          if (!read.has(m[1])) read.set(m[1], file.slice(ROOT.length + 1));
        }
      }
    }
    const missing = [...read]
      .filter(([k]) => !named.has(k) && !NOT_CONFIG.has(k))
      .map(([k, f]) => `${k} (read by ${f})`);
    expect(missing, 'add each to .env.example (a `# KEY=` line with the reader is enough)').toEqual(
      []
    );
  });
});
