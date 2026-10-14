import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSearch,
  didYouMean,
  corrections,
  createVocabulary,
  rerank,
  words,
} from '@bitbaum/searchkit';

const people = [
  { id: 'cato', name: 'Cato', bio: 'Builds the studio' },
  { id: 'kanye', name: 'Kanye West', bio: 'Music' },
  { id: 'mueller', name: 'Zoë Müller', bio: 'Ceramic artist in Zürich' },
  { id: 'loki', name: 'Loki', bio: 'A captain over a fleet of agents' },
  { id: 'loan', name: 'Bridge loan for a laptop', bio: '500 for school' },
  { id: 'oc', name: 'OrangeCat', bio: 'Your AI economic agent' },
  { id: 'bitcoin', name: 'Bitcoin hardware wallet', bio: 'cold storage' },
  { id: 'velo', name: 'Peer Loan - Fix My Velo', bio: 'repair' },
  { id: 'flower', name: "Paul's Flower Shop in Zurich", bio: 'Paul is opening a flower shop' },
];
const searcher = createSearch(people, {
  fields: [
    { name: 'name', get: p => p.name },
    { name: 'bio', get: p => p.bio },
  ],
});
const ids = q => searcher.search(q).map(h => h.item.id);

test('one wrong letter in a name still finds it — the SoundCloud case', () => {
  for (const q of ['cqto', 'cato', 'kayne west', 'kanye wset', 'lokii', 'koki', 'zoe muler']) {
    assert.ok(ids(q).length > 0, `nothing for ${q}`);
  }
  assert.equal(ids('cqto')[0], 'cato');
  assert.equal(ids('kayne')[0], 'kanye');
  assert.equal(ids('koki')[0], 'loki', 'a wrong first letter still matches');
});

test('finds as you type, from the first letters', () => {
  assert.equal(ids('lo')[0], 'loki');
  assert.equal(ids('bitco')[0], 'bitcoin');
  assert.equal(ids('bitcon')[0], 'bitcoin', 'a typo while typing');
});

test('an exact name beats a typo, and a typo beats nothing', () => {
  // "loki" matches Loki exactly; "loan" only within a typo budget it does not have (4 letters, 1 typo: loki→loan is 2).
  assert.deepEqual(ids('loki'), ['loki']);
  assert.equal(ids('loan')[0], 'loan');
});

test('German spelled without umlauts, and accents ignored', () => {
  assert.equal(ids('mueller')[0], 'mueller');
  assert.equal(ids('muller')[0], 'mueller');
  assert.equal(ids('zurich').includes('mueller'), true);
});

test('joined and split words', () => {
  assert.equal(ids('orange cat')[0], 'oc');
  assert.equal(ids('orangecat')[0], 'oc');
  assert.equal(ids('orangecta')[0], 'oc', 'joined, with a swap');
});

test('every word must match, in any order; a word too many is dropped, not fatal', () => {
  assert.equal(ids('west kanye')[0], 'kanye');
  assert.equal(ids('cato xylophone')[0], 'cato');
});

test("short words take no typos, so 'cat' does not become 'car'", () => {
  assert.equal(ids('cqt').length, 0);
});

test('a match in the name outranks the same word in the bio', () => {
  const s = createSearch(
    [
      { id: 'a', name: 'Repair café', bio: 'Zurich' },
      { id: 'b', name: 'Zurich bikes', bio: 'repair' },
    ],
    {
      fields: [
        { name: 'name', get: r => r.name },
        { name: 'bio', get: r => r.bio },
      ],
    }
  );
  assert.deepEqual(
    s.search('zurich').map(h => h.item.id),
    ['b', 'a']
  );
});

test('custom rank breaks only the ties left', () => {
  const s = createSearch(
    [
      { id: 'quiet', name: 'Loki', fans: 1 },
      { id: 'loud', name: 'Loki', fans: 99 },
    ],
    { fields: [{ name: 'name', get: r => r.name }], rank: r => r.fans }
  );
  assert.deepEqual(
    s.search('loki').map(h => h.item.id),
    ['loud', 'quiet']
  );
});

test('ranges mark what matched, the typed part of a prefix only', () => {
  const [hit] = searcher.search('bitco');
  assert.deepEqual(hit.matches.name, [{ start: 0, end: 5 }]);
  const [cato] = searcher.search('cqto');
  assert.deepEqual(cato.matches.name, [{ start: 0, end: 4 }]);
});

test("did you mean, against the collection's own words", () => {
  const vocab = createVocabulary(people.flatMap(p => words(p.name)));
  assert.equal(didYouMean('cqto', vocab), 'cato');
  assert.equal(didYouMean('cato', vocab), null);
  assert.deepEqual(corrections('kayne wset', vocab).sort(), ['kanye', 'west']);
});

test('a dropped letter in a 4-letter name still finds it, and a real 3-letter word stays itself', () => {
  assert.equal(ids('lki')[0], 'loki');
  assert.equal(ids('cto')[0], 'cato');
  const s = createSearch(
    [
      { id: 'cat', name: 'Cat' },
      { id: 'cart', name: 'Cart' },
    ],
    {
      fields: [{ name: 'name', get: r => r.name }],
    }
  );
  assert.deepEqual(
    s.search('cat').map(h => h.item.id),
    ['cat']
  );
});

test('a name typed whole outranks a longer name that only starts with it', () => {
  const s = createSearch(
    [
      { id: 'long', name: 'Loki — Capability Layer for a Permissionless Economy' },
      { id: 'loki', name: 'Loki' },
    ],
    { fields: [{ name: 'name', get: r => r.name }] }
  );
  for (const q of ['lki', 'loki', 'lok', 'koki']) {
    assert.equal(s.search(q)[0].item.id, 'loki', q);
  }
});

test("a site's own spelling rule applies to both sides", () => {
  // Swiss German as typed: "ie" read as "i", doubled letters as single.
  const swiss = w => w.replace(/ie/g, 'i').replace(/(.)\1/g, '$1');
  const s = createSearch(
    [
      { id: 'chuchichaestli', name: 'Chuchichäschtli' },
      { id: 'gruezi', name: 'Grüezi mitenand' },
    ],
    { fields: [{ name: 'name', get: r => r.name }], normalize: swiss }
  );
  assert.equal(s.search('gruzi mittenand')[0].item.id, 'gruezi');
  assert.equal(s.search('chuchichaschtli')[0].item.id, 'chuchichaestli');
});

test("the typo budget is the written word's, not the spelling rule's", () => {
  // The rule turns "vill" into "vil" on both sides; a slip in what was
  // TYPED ("cill", four letters) still gets the four-letter word's one typo.
  const swiss = (w: string) => w.replace(/ie/g, 'i').replace(/(.)\1/g, '$1');
  const s = createSearch(
    [
      { id: 'vill', name: 'vill' },
      { id: 'gaell', name: 'gäll' },
    ],
    { fields: [{ name: 'name', get: r => r.name }], normalize: swiss }
  );
  assert.equal(s.search('cill')[0]?.item.id, 'vill');
  assert.equal(s.search('gell')[0]?.item.id, 'gaell');
  // Three letters as written stay exact: the rule does not lengthen anything.
  assert.equal(s.search('cil').length, 0);
  const vocab = createVocabulary(['vil']);
  assert.deepEqual(corrections('cill', vocab, { normalize: swiss }), ['vil']);
});

test('a field counts as covered only when every typed word landed in it', () => {
  const s = createSearch(
    [
      { id: 'chalco', title: 'Chalco', body: 'Aluminium and gallium producer' },
      { id: 'gallium', title: 'Gallium: a chokepoint in chips', body: 'Who refines it' },
    ],
    {
      fields: [
        { name: 'title', get: r => r.title },
        { name: 'body', get: r => r.body },
      ],
    }
  );
  assert.equal(s.search('gallium ch')[0]?.item.id, 'gallium');
});

test('when no item has every word, the words some item has are kept, whichever they are', () => {
  const s = createSearch(
    [
      { id: 'snow', name: 'Jon Snow' },
      { id: 'smith', name: 'John Smith' },
    ],
    { fields: [{ name: 'name', get: r => r.name }] }
  );
  const ids = s.search('jon smith').map(h => h.item.id);
  assert.ok(ids.includes('smith'), ids.join());
  assert.ok(ids.includes('snow'), ids.join());
});

test('two words written apart, matched as one, rank below a real word one slip away', () => {
  const s = createSearch(
    [
      { id: 'switch', name: 'Switch OrangeCat to Claude' },
      { id: 'cato', name: 'Cato' },
      { id: 'apart', name: 'Orange Cat' },
    ],
    { fields: [{ name: 'name', get: r => r.name }] }
  );
  assert.equal(s.search('catto')[0]?.item.id, 'cato');
  // Still found: "orangecat" for "Orange Cat", and the camelCase word itself.
  const ids = s.search('orangecat').map(h => h.item.id);
  assert.ok(ids.includes('apart'), ids.join());
  assert.equal(ids[0], 'switch');
});

test('rerank orders found rows and keeps the ones it cannot place, after', () => {
  const rows = [{ t: 'Bridge loan' }, { t: 'Something else' }, { t: 'Loki' }];
  const out = rerank(rows, { fields: [{ name: 't', get: r => r.t }] }, 'lki');
  assert.equal(out[0].item.t, 'Loki');
  assert.equal(out.length, 3);
  assert.equal(out[out.length - 1].hit, null);
});
