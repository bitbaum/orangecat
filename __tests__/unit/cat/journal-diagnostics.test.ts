import { summarizeCatJournal } from '../../../scripts/diagnose-cat-logs.mjs';

it('reports only bounded categories and numeric status, never raw error data', () => {
  const privateText = 'private-key-and-private-prompt';
  const line = (err: unknown) =>
    JSON.stringify({
      source: 'cat/chat',
      level: 'error',
      message: privateText,
      data: { err, userId: privateText },
    });
  const report = summarizeCatJournal(
    [
      line({ statusCode: 429, message: privateText }),
      line({ statusCode: 429, message: privateText }),
      line({ statusCode: privateText, message: privateText }),
      JSON.stringify({ source: privateText, level: 'error', message: privateText }),
      'not JSON',
    ].join('\n')
  );
  expect(report.matched).toBe(3);
  expect(report.failures).toContainEqual({ category: 'rate_limit', status: '429', count: 2 });
  expect(JSON.stringify(report)).not.toContain(privateText);
});

it('counts the bot sends the shared pool could not answer, by vendor and status only', () => {
  const privateText = 'private-key-and-private-prompt';
  const turn = (links: unknown) =>
    JSON.stringify({
      source: 'companions/chat',
      level: 'warn',
      message: privateText,
      data: { links, userId: privateText },
    });
  const report = summarizeCatJournal(
    [
      turn([
        { provider: 'groq', status: 429 },
        { provider: 'google', status: 403 },
        { provider: 'openrouter', status: 429 },
      ]),
      turn([
        { provider: 'groq', status: 429 },
        { provider: privateText + ' with spaces', status: privateText },
      ]),
      JSON.stringify({ source: 'companions/chat', level: 'warn', data: { links: privateText } }),
    ].join('\n')
  );
  expect(report.bots.unanswered).toBe(2);
  expect(report.bots.links).toContainEqual({ provider: 'groq', status: '429', count: 2 });
  expect(report.bots.links).toContainEqual({ provider: 'google', status: '403', count: 1 });
  expect(report.bots.links).toContainEqual({ provider: 'unknown', status: 'unknown', count: 1 });
  // A bot's failure is not also counted as a Cat failure.
  expect(report.matched).toBe(0);
  expect(JSON.stringify(report)).not.toContain(privateText);
});

it("tells OrangeCat's own daily cap apart from a vendor's own 429", () => {
  const report = summarizeCatJournal(
    JSON.stringify({
      source: 'companions/chat',
      level: 'warn',
      data: {
        links: [
          { provider: 'groq', status: 429, cap: true },
          { provider: 'openrouter', status: 429 },
        ],
      },
    })
  );
  expect(report.bots.links).toContainEqual({ provider: 'groq', status: 'cap', count: 1 });
  expect(report.bots.links).toContainEqual({ provider: 'openrouter', status: '429', count: 1 });
});
