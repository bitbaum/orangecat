/**
 * A guard against the class of bug, not the instance.
 *
 * Hardcoded BTC/fiat rates were reintroduced three separate times — the rate
 * cache's "sane defaults", the create-flow sidebar's `?? { btcToChf: 86000 }`,
 * and a credit-metering fallback — because each looks harmless in isolation.
 * They are not: a plausible wrong rate passes every "is this a number" check
 * and silently mis-prices real money for as long as nobody happens to look. The
 * live CHF rate had drifted 65% from the seeded one.
 *
 * So the rule is mechanical now. If you need a rate, get a real one or admit
 * you don't have it. If this test fails, do not add an exception — delete the
 * constant.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** `btcToChf: 86000`, `BTC_USD: 97000`, `btcPriceUsd = 100000`, … */
const FORBIDDEN =
  /(btcTo(Chf|Usd|Eur|Gbp)|BTC_(CHF|USD|EUR|GBP)|btcPrice[A-Za-z]*|[A-Za-z]*RateFallback)['"]?\s*[:=]\s*[0-9_]{4,}/;

function sourceFiles(dir: string, out: string[] = []): string[] {
  // The directory entry already says what it is; a stat per file doubled the
  // syscalls on a slow filesystem.
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      sourceFiles(path, out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(path);
    }
  }
  return out;
}

/** Comments explaining the old bug are the point of this file, not a relapse. */
function isComment(line: string): boolean {
  const code = line.trim();
  return code.startsWith('*') || code.startsWith('//') || code.startsWith('/*');
}

describe('no hardcoded exchange rates in source', () => {
  it('has no fiat-per-BTC constant anywhere in src/', () => {
    const files = sourceFiles('src');
    // Sanity: a scan that silently found nothing to read would pass vacuously.
    expect(files.length).toBeGreaterThan(100);

    const offenders: string[] = [];
    for (const file of files) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (FORBIDDEN.test(line) && !isComment(line)) {
            offenders.push(`${file}:${i + 1}: ${line.trim()}`);
          }
        });
    }

    expect(offenders).toEqual([]);
    // Reads every file under src/ once — a full-tree read cannot get cheaper
    // than that, and under the whole suite's parallel I/O it outran 30s.
  }, 120_000);
});
