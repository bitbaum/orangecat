import { parseImportedMemories } from '@/services/cat/memory';
import { formatMemoriesForExport } from '@/config/cat-memory-import';

/**
 * Parser for pasted memory exports from other AIs. Pure function — no DB/embeds.
 * Covers the shapes we actually receive: category-grouped markdown with date
 * tags and bullets, a plain JSON array, and the junk we must drop.
 */
describe('parseImportedMemories', () => {
  it('returns [] for empty or whitespace input', () => {
    expect(parseImportedMemories('')).toEqual([]);
    expect(parseImportedMemories('   \n  ')).toEqual([]);
  });

  it('strips category headers, bullets, numbering and date prefixes', () => {
    const raw = [
      '# Identity',
      '- [2026-01-01] - Based in Zürich',
      '* Speaks English and Russian',
      '## Projects',
      '1. [unknown] - Building Loki, a life-OS for builders',
      '**Preferences**',
      'Prefers Lightning over on-chain payments',
    ].join('\n');

    const facts = parseImportedMemories(raw);

    expect(facts).toEqual([
      'Based in Zürich',
      'Speaks English and Russian',
      'Building Loki, a life-OS for builders',
      'Prefers Lightning over on-chain payments',
    ]);
    // Category headings never become memories.
    expect(facts).not.toContain('Identity');
    expect(facts).not.toContain('Projects');
    expect(facts).not.toContain('Preferences');
  });

  it('accepts a JSON array of strings verbatim', () => {
    const raw = '```json\n["Prefers dark mode", "Works in Zürich"]\n```';
    expect(parseImportedMemories(raw)).toEqual(['Prefers dark mode', 'Works in Zürich']);
  });

  it('drops "(none)" placeholders and exact duplicates', () => {
    const raw = [
      '# Career',
      '(none)',
      'Ex-banker turned engineer',
      'Ex-banker turned engineer',
    ].join('\n');
    expect(parseImportedMemories(raw)).toEqual(['Ex-banker turned engineer']);
  });

  it('handles a code-fenced markdown export like the copy-back flow produces', () => {
    const raw = [
      '```',
      'Identity',
      '[2026-03-04] - Name is George',
      'Preferences',
      '- Likes concise answers',
      '```',
    ].join('\n');
    expect(parseImportedMemories(raw)).toEqual(['Name is George', 'Likes concise answers']);
  });

  it('caps the number of imported facts at 200', () => {
    const raw = Array.from({ length: 500 }, (_, i) => `Fact number ${i}`).join('\n');
    expect(parseImportedMemories(raw)).toHaveLength(200);
  });
});

/**
 * Export is the "right of exit" half — its output must round-trip back through
 * the importer unchanged, so memory is portable to any AI (or back to OrangeCat).
 */
describe('formatMemoriesForExport round-trips through parseImportedMemories', () => {
  it('re-parses to exactly the same facts', () => {
    const facts = [
      'Name is George, based in Zürich, Switzerland',
      'Building OrangeCat, a Bitcoin-native platform',
      'Prefers Lightning over on-chain payments',
    ];
    const exported = formatMemoriesForExport(facts);
    expect(parseImportedMemories(exported)).toEqual(facts);
  });

  it('drops blank entries and trims on export', () => {
    expect(formatMemoriesForExport(['  Likes concise answers  ', '', '   '])).toBe(
      'Likes concise answers'
    );
  });
});
