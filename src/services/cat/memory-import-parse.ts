/**
 * Parsing a memory export pasted from another AI into a clean list of facts.
 * Pure text; storing them is importMemories in memory.ts. Moved verbatim from
 * memory.ts.
 */

import { MEMORY_IMPORT_CATEGORIES } from '@/config/cat-memory-import';

/** Cap facts accepted from a single paste — a one-time bulk import, kept sane. */
const MAX_IMPORT_FACTS = 200;
/** Imported entries may be a full sentence — allow more than a chat-distilled fact. */
const MAX_IMPORT_FACT_CHARS = 500;

const IMPORT_HEADER_SET = new Set<string>(MEMORY_IMPORT_CATEGORIES.map(c => c.toLowerCase()));

/** Some assistants answer with a JSON array of strings — accept that shape too. */
function tryParseJsonArray(raw: string): string[] {
  const cleaned = raw.replace(/```(?:json)?/gi, '').trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) {
    return [];
  }
  try {
    const arr = JSON.parse(match[0]);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Strip list markers, numbering, markdown headings/bold from a line. */
function stripLineDecorations(line: string): string {
  return line
    .replace(/^\s*#{1,6}\s*/, '') // markdown heading
    .replace(/^\s*[-*•·]\s+/, '') // bullet
    .replace(/^\s*\d+[.)]\s+/, '') // "1. " / "1) "
    .replace(/\*\*/g, '') // bold
    .replace(/^\s*[-–—]\s*/, '') // stray leading dash (e.g. exposed after a date strip)
    .trim();
}

/** Remove a leading date tag like "[2026-01-01] - " or "[unknown] - ". */
function stripDatePrefix(line: string): string {
  return line.replace(/^\[[^\]]*\]\s*[-–—:]\s*/, '').trim();
}

/** True when a line is just a category heading (e.g. "Projects", "**Identity**:"). */
function isImportHeader(line: string): boolean {
  const normalized = stripLineDecorations(line).replace(/:$/, '').trim().toLowerCase();
  return IMPORT_HEADER_SET.has(normalized);
}

/**
 * Turn a pasted memory export (from any AI) into a clean list of fact strings.
 * Defensive: accepts a JSON array, or category-grouped markdown/bulleted/dated
 * lines. Strips headers, bullets, numbering and date tags; dedupes and caps.
 */
export function parseImportedMemories(raw: string): string[] {
  if (!raw || !raw.trim()) {
    return [];
  }
  const jsonFacts = tryParseJsonArray(raw);
  const isJson = jsonFacts.length > 0;
  const lines = isJson ? jsonFacts : raw.replace(/```(?:json|markdown)?/gi, '').split('\n');

  const seen = new Set<string>();
  const facts: string[] = [];
  for (const rawLine of lines) {
    let line = (rawLine ?? '').trim();
    if (!line) {
      continue;
    }
    if (!isJson) {
      if (isImportHeader(line)) {
        continue;
      }
      line = stripDatePrefix(stripLineDecorations(line));
      line = stripLineDecorations(line); // a date strip can expose a leading dash
    }
    const lower = line.toLowerCase();
    if (!line || line.length < 3 || lower === '(none)' || lower === 'none') {
      continue;
    }
    const key = lower.slice(0, MAX_IMPORT_FACT_CHARS);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    facts.push(line.slice(0, MAX_IMPORT_FACT_CHARS));
    if (facts.length >= MAX_IMPORT_FACTS) {
      break;
    }
  }
  return facts;
}
