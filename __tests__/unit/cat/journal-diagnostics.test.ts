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
