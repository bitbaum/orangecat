import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Public CI logs receive counts and HTTP status classes, never journal text,
 * provider error messages, prompts, identifiers, headers or credentials. */
export function summarizeCatJournal(input) {
  const counts = new Map();
  // A bot turn the shared pool could not answer, per vendor and status
  // (services/ai/chain-failure-summary.ts writes exactly those two).
  const botLinks = new Map();
  let botTurns = 0;
  let matched = 0;
  for (const line of input.split('\n')) {
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    if (row?.source === 'companions/chat' && Array.isArray(row.data?.links)) {
      botTurns++;
      for (const link of row.data.links) {
        const provider =
          typeof link?.provider === 'string' && /^[a-z0-9_-]{1,40}$/.test(link.provider)
            ? link.provider
            : 'unknown';
        const status =
          Number.isInteger(link?.status) && link.status >= 400 && link.status <= 599
            ? link.status
            : 'unknown';
        const key = `${provider}:${status}`;
        botLinks.set(key, (botLinks.get(key) ?? 0) + 1);
      }
      continue;
    }
    if (row?.source !== 'cat/chat' || !['warn', 'error'].includes(row.level)) continue;
    matched++;
    const error = row.data?.err;
    const candidate = error?.statusCode ?? error?.status;
    const status =
      Number.isInteger(candidate) && candidate >= 400 && candidate <= 599 ? candidate : null;
    const message = typeof error?.message === 'string' ? error.message : '';
    const category =
      status === 429 || /rate.limit|quota/i.test(message)
        ? 'rate_limit'
        : status === 401 || status === 403
          ? 'credentials'
          : status === 404
            ? 'unavailable_model_or_endpoint'
            : status === 413 || /context.length|too.many.tokens/i.test(message)
              ? 'request_size'
              : /tool|function/i.test(message)
                ? 'tool_protocol'
                : /timeout|abort/i.test(message)
                  ? 'deadline'
                  : status !== null && status >= 500
                    ? 'upstream'
                    : 'unclassified';
    const key = `${category}:${status ?? 'unknown'}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return {
    matched,
    failures: [...counts]
      .sort()
      .map(([key, count]) => ({ category: key.split(':')[0], status: key.split(':')[1], count })),
    // Bot sends no link of the shared pool answered, and how each link failed.
    bots: {
      unanswered: botTurns,
      links: [...botLinks]
        .sort()
        .map(([key, count]) => ({ provider: key.split(':')[0], status: key.split(':')[1], count })),
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stdout.write(
    JSON.stringify(summarizeCatJournal(readFileSync(0, 'utf8')), null, 2) + '\n'
  );
}
