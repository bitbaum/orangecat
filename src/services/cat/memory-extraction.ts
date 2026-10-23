import { embedTexts } from '@/services/ai/embeddings';
import { MAX_FACT_CHARS, isPassiveMemoryFact, memoryFactKey } from './memory-facts';

const MAX_FACTS_PER_TURN = 3;

import type { MemoryAiService } from './memory';

const EXTRACTION_SYSTEM = `You extract durable, user-specific facts worth remembering long-term about a person, from one chat exchange.

Return ONLY a JSON array of short factual statements written in the third person, e.g.:
["Prefers Lightning over on-chain payments", "Building Loki, a life-OS for builders", "Based in Zürich"]

Include ONLY stable facts: preferences, identity, goals, skills, relationships, or constraints that will still be true next week.
EXCLUDE: current writing tasks, first-party app usage or praise, one-off requests, questions, the assistant's suggestions, transient state, and anything trivial or already obvious.
"I want to write an article" and "OrangeCat is supposed to be the best place to write" contain no durable personal fact. An explicit ongoing habit such as writing weekly articles is different.
If there is nothing durable worth remembering, return exactly [].
Return at most ${MAX_FACTS_PER_TURN} facts. No prose, no markdown — just the JSON array.`;

/** Parse the model's reply into a clean list of fact strings (defensive). */
function parseFacts(raw: string): string[] {
  if (!raw) {
    return [];
  }
  // Strip code fences and grab the first JSON array if the model wrapped it.
  const cleaned = raw.replace(/```(?:json)?/gi, '').trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) {
    return [];
  }
  try {
    const arr = JSON.parse(match[0]);
    if (!Array.isArray(arr)) {
      return [];
    }
    const seen = new Set<string>();
    return arr
      .filter((x): x is string => typeof x === 'string')
      .map(s => s.trim().slice(0, MAX_FACT_CHARS))
      .filter(s => s.length >= 3 && isPassiveMemoryFact(s))
      .filter(s => {
        const key = memoryFactKey(s);
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .slice(0, MAX_FACTS_PER_TURN);
  } catch {
    return [];
  }
}

/** Distil and embed candidates; storage, consent and suppression remain in the memory service. */
export async function distillMemories(
  userMessage: string,
  assistantMessage: string,
  aiService: MemoryAiService,
  model: string
): Promise<Array<{ content: string; vector: number[] }>> {
  const { content } = await aiService.chatCompletion({
    model,
    temperature: 0,
    messages: [
      { role: 'system', content: EXTRACTION_SYSTEM },
      {
        role: 'user',
        content: `User said: "${userMessage}"\n\nAssistant replied: "${assistantMessage.slice(0, 800)}"\n\nExtract durable facts about the user as a JSON array.`,
      },
    ],
  });
  const facts = parseFacts(content);
  if (!facts.length) {
    return [];
  }
  const vectors = await embedTexts(facts);
  return facts.flatMap((fact, index) => {
    const vector = vectors[index];
    return vector?.length ? [{ content: fact, vector }] : [];
  });
}
