import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  editDistance,
  fold,
  prefixDistance,
  tokenize,
  typoBudget,
  umlautSpelling,
  words,
} from '@bitbaum/searchkit';

test('folds case, accents and letters with no decomposition', () => {
  assert.equal(fold('Straße Zürich Café Æble Øre Łódź'), 'strasse zurich cafe aeble ore lodz');
});

test('splits camelCase, handles and separators, keeping original offsets', () => {
  assert.deepEqual(words('OrangeCat'), ['orange', 'cat']);
  assert.deepEqual(words('@dj_koze'), ['dj', 'koze']);
  assert.deepEqual(words('orange-cat v2'), ['orange', 'cat', 'v', '2']);
  const [, second] = tokenize('Hello Zürich');
  assert.deepEqual(second, { term: 'zurich', index: 1, start: 6, end: 12 });
});

test('spells German umlauts out the way people type them without', () => {
  assert.equal(umlautSpelling('Müller'), 'mueller');
  assert.equal(umlautSpelling('Mueller'), null);
});

test('counts the four slips as one typo each — a swap included', () => {
  assert.equal(editDistance('cqto', 'cato'), 1); // wrong letter
  assert.equal(editDistance('cto', 'cato'), 1); // dropped
  assert.equal(editDistance('caato', 'cato'), 1); // doubled
  assert.equal(editDistance('kayne', 'kanye'), 1); // swapped: plain Levenshtein says 2
  assert.equal(editDistance('kitten', 'sitting'), 3);
  assert.equal(editDistance('kitten', 'sitting', 1), 2, 'stops early past max');
});

test('measures the distance to the start of a longer word, for typing', () => {
  assert.equal(prefixDistance('bitco', 'bitcoin'), 0);
  assert.equal(prefixDistance('bitcon', 'bitcoin'), 1);
  assert.equal(prefixDistance('btc', 'bitcoin', 1), 1);
  assert.equal(prefixDistance('zzzz', 'bitcoin', 1), 2);
});

test('allows no typo under 4 letters, one from 4, two from 8', () => {
  assert.deepEqual(
    [3, 4, 7, 8].map(n => typoBudget(n)),
    [0, 1, 1, 2]
  );
});
