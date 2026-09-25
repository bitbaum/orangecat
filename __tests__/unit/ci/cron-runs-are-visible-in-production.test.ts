/**
 * A scheduled job must leave a trace production actually keeps.
 *
 * `logger`'s active level is `warn` in production (`productionLevel: 'warn'` in
 * src/utils/logger.ts), so every `logger.info` call is discarded there. Eight
 * cron routes logged their run record at info — "solon-sync run", "cat daily
 * brief run", "Weekly digest cron completed", and the rest — which means eight
 * scheduled jobs could not be proven to have run at all.
 *
 * The cat-health route made the cost explicit. Its own comment claimed the run
 * was "logged either way, including when it decided NOT to alert: a run that
 * quietly did nothing is indistinguishable from a run that never happened,
 * which is how the nightly eval managed to skip for two nights unnoticed" —
 * written with logger.info, so in production it was never true. Confirmed on
 * the box 2026-09-13: a successful run (curl exit 0, HTTP 2xx) left NO journal
 * entry whatsoever.
 *
 * Fixing the eight instances does not end the class; the ninth cron someone
 * adds will reach for logger.info like the others did. This gate does.
 *
 * Deliberately scoped to cron routes. Flipping the logger's production level
 * globally would switch on 165 call sites, 31 of them per-request handlers
 * logging userIds and wallet ids — a volume and privacy change, not a fix.
 * A scheduled job runs once and its record is an operational fact.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const CRON_DIR = join(__dirname, '../../../src/app/api/cron');

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...routeFiles(full));
    } else if (entry === 'route.ts') {
      out.push(full);
    }
  }
  return out;
}

describe('a cron run is visible in production', () => {
  const files = routeFiles(CRON_DIR);

  it('finds the cron routes, or this gate checks nothing', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it('never records a run at a level production discards', () => {
    const offenders = files
      .filter(f => readFileSync(f, 'utf8').includes('logger.info('))
      .map(f => f.slice(f.indexOf('api/cron/')));

    expect(
      offenders,
      `logger.info is dropped in production (productionLevel: 'warn'), so these ` +
        `scheduled jobs would leave no trace: ${offenders.join(', ')}`
    ).toEqual([]);
  });

  it('pins the production level this gate depends on', () => {
    // If productionLevel ever becomes 'info', the rule above stops being
    // necessary — and a gate whose premise silently changed is worse than none.
    const logger = readFileSync(join(__dirname, '../../../src/utils/logger.ts'), 'utf8');
    expect(logger).toContain("productionLevel: 'warn'");
  });
});
