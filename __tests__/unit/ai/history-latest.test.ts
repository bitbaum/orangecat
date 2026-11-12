/**
 * The model is shown the LATEST lines of a thread, in the order they were said.
 *
 * Read ascending with a limit, a thread longer than the limit showed the
 * model its first twenty lines forever: every newer line, a bot's own steps
 * and its routine posts included, fell out of its view.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HISTORY_LINES, latestFirstToChronological } from '@/services/ai/sendMessage';

describe('the thread the model reads', () => {
  it('reads the newest lines, then puts them back in the order they were said', () => {
    const src = readFileSync('src/services/ai/sendMessage.ts', 'utf8');
    const query = src.slice(
      src.indexOf('.from(DATABASE_TABLES.AI_MESSAGES)'),
      src.indexOf('.limit(HISTORY_LINES)')
    );
    expect(query).toContain(".order('created_at', { ascending: false })");
    expect(src).toContain('latestFirstToChronological((historyData || [])');
    expect(HISTORY_LINES).toBe(20);
    const newestFirst = [{ n: 30 }, { n: 29 }, { n: 28 }];
    expect(latestFirstToChronological(newestFirst).map(r => r.n)).toEqual([28, 29, 30]);
    expect(newestFirst.map(r => r.n)).toEqual([30, 29, 28]);
  });
});
