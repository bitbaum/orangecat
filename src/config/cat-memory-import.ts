/**
 * Cat Memory Import — SSOT for the "bring your memory from another AI" bridge.
 *
 * MEMORY_IMPORT_PROMPT is the exact text a user copies into another AI (ChatGPT,
 * Grok, Gemini, Claude, …) to export what it knows about them. They paste the
 * result back into OrangeCat, which distils it into durable Cat memories.
 *
 * Kept here (not inline in the component) so the prompt is defined once and can
 * be reused by docs, onboarding, or a future Loki import without drift.
 * The reciprocal direction (export FROM OrangeCat in this same shape) is the
 * "right of exit" half — portable, user-owned memory, not a walled garden.
 */

/** Categories the import parser understands as headings (never stored as facts). */
export const MEMORY_IMPORT_CATEGORIES = [
  'Instructions',
  'Identity',
  'Career',
  'Projects',
  'Preferences',
] as const;

/** Filename for the downloadable memory export. */
export const MEMORY_EXPORT_FILENAME = 'orangecat-cat-memory.txt';

/**
 * Format stored memories into the portable, re-importable shape — one fact per
 * line. This is the "right of exit" half: the output round-trips straight back
 * through parseImportedMemories(), into another AI, or back into OrangeCat.
 * Deliberately plain text (no headers/JSON) so it's maximally portable.
 */
export function formatMemoriesForExport(contents: string[]): string {
  return contents
    .map(c => c.trim())
    .filter(Boolean)
    .join('\n');
}

export const MEMORY_IMPORT_PROMPT = `Export everything you've learned and stored about me from our past conversations, so I can bring it to another AI assistant. Preserve my own words where possible, especially instructions and preferences.

## Categories (output in this order):

1. **Instructions**: Rules I've explicitly asked you to follow going forward — tone, format, style, "always do X", "never do Y", and corrections to your behaviour. Only from stored memory, not one-off requests.
2. **Identity**: Name, location, languages, background, interests — stable facts about who I am.
3. **Career**: Current and past roles, companies, and skill areas.
4. **Projects**: Things I'm meaningfully building or committed to — one entry per project, with what it does and its current status. Lead each entry with the project name.
5. **Preferences**: Opinions, tastes, and working-style preferences that apply broadly.

## Format:
- A section header per category.
- One entry per line. Keep each entry to a single, self-contained sentence.
- If you know when something was established, prefix it: [YYYY-MM-DD] - entry. Otherwise just write the entry.

## Output:
- Wrap the whole export in a single code block so it's easy to copy.
- Only include things you actually have stored — never invent or pad. If a category is empty, write "(none)".`;
