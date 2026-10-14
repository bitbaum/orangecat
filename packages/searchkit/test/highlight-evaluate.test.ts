import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSearch,
  evaluate,
  highlightQuery,
  highlightRanges,
  snippet,
  typoCases,
  typoVariants,
} from '@bitbaum/searchkit';

const marked = parts => parts.filter(p => p.match).map(p => p.text);

test('marks word starts only, never letters inside a word', () => {
  assert.deepEqual(marked(highlightQuery('the technological local loop', 'lo')), ['lo', 'lo']);
  assert.deepEqual(marked(highlightQuery('Fix My Velo', 'lo')), []);
  assert.deepEqual(marked(highlightQuery('Remise Rosa in Zürich', 'zurich')), ['Zürich']);
});

test('ranges merge and keep every character of the text', () => {
  const text = 'Kanye West';
  const parts = highlightRanges(text, [
    { start: 6, end: 10 },
    { start: 0, end: 5 },
    { start: 2, end: 4 },
  ]);
  assert.equal(parts.map(p => p.text).join(''), text);
  assert.deepEqual(marked(parts), ['Kanye', 'West']);
});

test('generates the slips people make, never the word itself', () => {
  const v = typoVariants('cato');
  for (const slip of ['xato', 'cto', 'ccato', 'acto']) {
    assert.ok(v.includes(slip), slip);
  }
  assert.ok(!v.includes('cato'));
});

test('a generated typo suite over real-looking names passes in full', async () => {
  const names = [
    { id: '1', name: 'Kanye West' },
    { id: '2', name: 'Rihanna' },
    { id: '3', name: 'Zoë Müller' },
    { id: '4', name: 'Farmhouse' },
    { id: '5', name: 'Substrata' },
    { id: '6', name: 'Open Accounting' },
    { id: '7', name: "Paul's Flower Shop" },
    { id: '8', name: 'Minimal DJ Sets' },
  ];
  const s = createSearch(names, { fields: [{ name: 'name', get: n => n.name }] });
  const cases = typoCases(names);
  assert.ok(cases.length > 200);
  const report = await evaluate(cases, q => s.search(q).map(h => h.item.id));
  assert.equal(report.zeroResults, 0, JSON.stringify(report.misses.slice(0, 5)));
  assert.equal(report.successAt3, 1, JSON.stringify(report.misses.slice(0, 5)));
  assert.ok(report.successAt1 > 0.97, String(report.successAt1));
});

test('typoCases splits names into the words the search sees', () => {
  const queries = typoCases([{ id: 'n', name: 'No-screen Sunday' }]).map(c => c.query);
  assert.ok(queries.length > 0);
  assert.ok(
    queries.every(q => !q.includes('-')),
    queries.find(q => q.includes('-'))
  );
});

test('a snippet shows the match inside a long text, cut at words, with ellipses', () => {
  const text =
    "I'm Alisa, an independent artist creating Bitcoin-themed illustrations and paintings. " +
    'I need funds to cover canvas, paint supplies and studio time. The series ends with a ' +
    'large piece about the settings of a quiet morning, sold as a limited print.';
  const at = text.indexOf('settings');
  const { text: cut, ranges } = snippet(text, [{ start: at, end: at + 8 }], { maxLength: 80 });
  assert.ok(cut.startsWith('…') && cut.length <= 82, cut);
  assert.equal(cut.slice(ranges[0].start, ranges[0].end), 'settings');
  assert.equal(snippet('short', []).text, 'short');
});
