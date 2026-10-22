import { APP_NAME } from '@/config/brand';

export const MAX_FACT_CHARS = 240;
export const MEMORY_DEDUP_SIMILARITY = 0.88;

export function memoryFactKey(content: string): string {
  return content
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.!?。？！]+$/u, '');
}

/** Automatic memory excludes current writing tasks and obvious first-party usage. */
export function isPassiveMemoryFact(content: string): boolean {
  const fact = content.trim().replace(/^(?:the )?user\s+/i, '');
  const currentWritingTask =
    /^(?:wants|intends|needs|plans|would like|is trying)\s+to\s+(?:write|draft|edit|publish|create)\s+(?:an?|the|this)\s+(?:article|blog post|post)\b/i;
  const ongoingHabit =
    /\b(?:daily|weekly|monthly|regularly)\b|\b(?:every|each)\s+(?:day|week|month|year)\b/i;
  if (currentWritingTask.test(fact) && !ongoingHabit.test(fact)) {
    return false;
  }
  const usage = fact.match(/^(?:uses|prefers|likes|loves)\s+(?:the\s+)?(.+)$/iu)?.[1];
  if (!usage) {
    return true;
  }
  const words = usage.match(/[\p{L}\p{N}]+/gu) ?? [];
  const nameWords = APP_NAME.replace(/([a-z])([A-Z])/g, '$1 $2').match(/[\p{L}\p{N}]+/gu) ?? [];
  const app = memoryFactKey(APP_NAME).replace(/[\s\p{P}]+/gu, '');
  for (let count = 1; count <= Math.min(words.length, nameWords.length); count++) {
    if (memoryFactKey(words.slice(0, count).join('')) === app) {
      return false;
    }
  }
  return true;
}

/** Compare accepted candidates too: database matching cannot see an uninserted batch. */
export function areMemoryVectorsSimilar(a: readonly number[], b: readonly number[]): boolean {
  if (!a.length || a.length !== b.length) {
    return false;
  }
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    if (!Number.isFinite(a[i]) || !Number.isFinite(b[i])) {
      return false;
    }
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return normA > 0 && normB > 0 && dot / Math.sqrt(normA * normB) >= MEMORY_DEDUP_SIMILARITY;
}

export interface MemoryCandidate {
  content: string;
  vector: number[];
}

/** Similar embeddings must not collapse different amounts or opposite statements. */
export function areMemoryCandidatesEquivalent(a: MemoryCandidate, b: MemoryCandidate): boolean {
  if (memoryFactKey(a.content) === memoryFactKey(b.content)) {
    return true;
  }
  const numbers = (text: string) => (text.match(/\d+(?:[.,]\d+)*/g) ?? []).join('|');
  if (numbers(a.content) !== numbers(b.content)) {
    return false;
  }
  const negative = /\b(?:not|no|never|without|cannot|can't|don't|doesn't|isn't)\b/i;
  if (negative.test(a.content) !== negative.test(b.content)) {
    return false;
  }
  return areMemoryVectorsSimilar(a.vector, b.vector);
}
