/**
 * How hard is this message?
 *
 * Split out of auto-router.ts, which had grown to do two separable jobs:
 * score the turn, and pick a model for the score. This half is the scoring,
 * and it has its own consumers — the platform chain asks it whether a turn is
 * worth a better free model, without wanting a router at all.
 *
 * It is a keyword heuristic, deliberately: it runs before every message, so it
 * cannot cost a model call. That puts the burden on the table below being
 * honest about what this product is actually asked, which is the bug it
 * carried for a long time — 39 entries about code, research, law and medicine
 * and nothing about product judgement, on a platform for building things.
 */

export interface ComplexityAnalysis {
  /** Complexity score from 0 (simple) to 1 (complex) */
  score: number;
  /** Human-readable reason */
  reason: string;
  /** Estimated total tokens (input + output) */
  estimatedTokens: number;
  /** Detected task type */
  taskType: TaskType;
}

export type TaskType =
  | 'simple_question'
  | 'coding'
  | 'analysis'
  | 'creative'
  | 'research'
  | 'conversation'
  | 'translation'
  | 'summarization'
  | 'complex_reasoning';

// ==================== COMPLEXITY KEYWORDS ====================

const COMPLEXITY_KEYWORDS: Record<string, { weight: number; taskType: TaskType }> = {
  // Coding keywords
  code: { weight: 0.2, taskType: 'coding' },
  programming: { weight: 0.2, taskType: 'coding' },
  debug: { weight: 0.25, taskType: 'coding' },
  algorithm: { weight: 0.3, taskType: 'coding' },
  refactor: { weight: 0.25, taskType: 'coding' },
  typescript: { weight: 0.2, taskType: 'coding' },
  javascript: { weight: 0.2, taskType: 'coding' },
  python: { weight: 0.2, taskType: 'coding' },
  function: { weight: 0.15, taskType: 'coding' },
  class: { weight: 0.15, taskType: 'coding' },

  // Analysis keywords
  analyze: { weight: 0.25, taskType: 'analysis' },
  compare: { weight: 0.2, taskType: 'analysis' },
  evaluate: { weight: 0.25, taskType: 'analysis' },
  assess: { weight: 0.2, taskType: 'analysis' },
  examine: { weight: 0.2, taskType: 'analysis' },

  // Research keywords
  research: { weight: 0.3, taskType: 'research' },
  thesis: { weight: 0.35, taskType: 'research' },
  academic: { weight: 0.3, taskType: 'research' },
  scientific: { weight: 0.3, taskType: 'research' },
  study: { weight: 0.2, taskType: 'research' },

  // Complex reasoning
  'step by step': { weight: 0.25, taskType: 'complex_reasoning' },
  'in detail': { weight: 0.2, taskType: 'complex_reasoning' },
  comprehensive: { weight: 0.25, taskType: 'complex_reasoning' },
  thorough: { weight: 0.2, taskType: 'complex_reasoning' },
  explain: { weight: 0.15, taskType: 'complex_reasoning' },

  // Creative keywords
  write: { weight: 0.15, taskType: 'creative' },
  story: { weight: 0.2, taskType: 'creative' },
  creative: { weight: 0.2, taskType: 'creative' },
  poem: { weight: 0.2, taskType: 'creative' },
  essay: { weight: 0.2, taskType: 'creative' },

  // Professional domains (higher complexity)
  legal: { weight: 0.35, taskType: 'complex_reasoning' },
  medical: { weight: 0.35, taskType: 'complex_reasoning' },
  financial: { weight: 0.3, taskType: 'analysis' },
  contract: { weight: 0.3, taskType: 'complex_reasoning' },

  // Product, business and design judgement.
  //
  // This table had 39 entries and not one of them covered "think with me" —
  // the hardest thing a small model does, and the most common serious ask on
  // a platform for building things. A real strategy question ("what do you
  // think of this idea and how would you set it up") scored 0.0 and routed to
  // the cheapest tier, because every keyword here was about code, research,
  // law or medicine. Weights are deliberately modest: two or three of these
  // together should clear 'standard', one alone should not.
  idea: { weight: 0.2, taskType: 'analysis' },
  strategy: { weight: 0.25, taskType: 'analysis' },
  business: { weight: 0.2, taskType: 'analysis' },
  market: { weight: 0.2, taskType: 'analysis' },
  competitor: { weight: 0.25, taskType: 'analysis' },
  roadmap: { weight: 0.2, taskType: 'analysis' },
  architecture: { weight: 0.3, taskType: 'complex_reasoning' },
  'trade-off': { weight: 0.25, taskType: 'complex_reasoning' },
  tradeoff: { weight: 0.25, taskType: 'complex_reasoning' },
  'pros and cons': { weight: 0.25, taskType: 'complex_reasoning' },

  // Evaluative asks. Phrased as verbs rather than punctuation on purpose: the
  // '?' bump below is useless for the many people who never type one.
  'what do you think': { weight: 0.25, taskType: 'analysis' },
  'how would you': { weight: 0.25, taskType: 'complex_reasoning' },
  'what would you': { weight: 0.25, taskType: 'complex_reasoning' },
  'set it up': { weight: 0.2, taskType: 'complex_reasoning' },
  'should i': { weight: 0.2, taskType: 'analysis' },
  'worth it': { weight: 0.2, taskType: 'analysis' },
  'good idea': { weight: 0.2, taskType: 'analysis' },
  'am i missing': { weight: 0.25, taskType: 'analysis' },

  // Translation
  translate: { weight: 0.15, taskType: 'translation' },
  translation: { weight: 0.15, taskType: 'translation' },

  // Summarization
  summarize: { weight: 0.1, taskType: 'summarization' },
  summary: { weight: 0.1, taskType: 'summarization' },
  tldr: { weight: 0.1, taskType: 'summarization' },
};

function estimateOutputTokens(taskType: TaskType, inputTokens: number): number {
  // Different task types have different output patterns
  const multipliers: Record<TaskType, number> = {
    simple_question: 0.5,
    coding: 2.0,
    analysis: 1.5,
    creative: 2.0,
    research: 2.5,
    conversation: 0.8,
    translation: 1.0,
    summarization: 0.3,
    complex_reasoning: 1.5,
  };

  const multiplier = multipliers[taskType] || 1.0;
  const estimated = Math.ceil(inputTokens * multiplier);

  // Clamp to reasonable range
  return Math.min(Math.max(estimated, 100), 4000);
}

export function analyzeComplexity(
  message: string,
  history: Array<{ role: string; content: string }>
): ComplexityAnalysis {
  let score = 0;
  const reasons: string[] = [];
  let detectedTaskType: TaskType = 'conversation';
  const taskTypeCounts: Record<TaskType, number> = {
    simple_question: 0,
    coding: 0,
    analysis: 0,
    creative: 0,
    research: 0,
    conversation: 0,
    translation: 0,
    summarization: 0,
    complex_reasoning: 0,
  };

  const lowerMessage = message.toLowerCase();

  // Length-based complexity
  const messageLength = message.length;
  // Thresholds lowered from 2000/500 on 2026-09-17. Someone who types four
  // sentences of context is not asking a one-line question, and the old
  // floor put a 467-character product brief in the same bucket as "hi".
  if (messageLength > 1500) {
    score += 0.3;
    reasons.push('Long input');
  } else if (messageLength > 700) {
    score += 0.2;
    reasons.push('Medium length input');
  } else if (messageLength > 350) {
    score += 0.1;
    reasons.push('Multi-sentence input');
  }

  // Keyword-based complexity detection
  for (const [keyword, config] of Object.entries(COMPLEXITY_KEYWORDS)) {
    if (lowerMessage.includes(keyword)) {
      score += config.weight;
      taskTypeCounts[config.taskType]++;
    }
  }

  // Find dominant task type
  let maxCount = 0;
  for (const [taskType, count] of Object.entries(taskTypeCounts)) {
    if (count > maxCount) {
      maxCount = count;
      detectedTaskType = taskType as TaskType;
    }
  }

  if (maxCount > 0) {
    reasons.push(`${detectedTaskType.replace('_', ' ')} detected`);
  }

  // Conversation length complexity
  const historyTokens = history.reduce((acc, m) => acc + m.content.length / 4, 0);
  if (historyTokens > 4000) {
    score += 0.2;
    reasons.push('Long conversation context');
  } else if (historyTokens > 1000) {
    score += 0.1;
  }

  // Question complexity (multiple questions)
  const questionMarks = (message.match(/\?/g) || []).length;
  if (questionMarks > 3) {
    score += 0.2;
    reasons.push('Multiple questions');
  } else if (questionMarks > 1) {
    score += 0.1;
  }

  // Code block detection
  const codeBlocks = (message.match(/```/g) || []).length / 2;
  if (codeBlocks > 0) {
    score += 0.15 * Math.min(codeBlocks, 3);
    if (codeBlocks > 0) {
      detectedTaskType = 'coding';
      reasons.push('Contains code');
    }
  }

  // Numbered list detection (often indicates multi-step tasks)
  const numberedItems = (message.match(/^\d+\./gm) || []).length;
  if (numberedItems > 3) {
    score += 0.15;
    reasons.push('Multi-step task');
  }

  // Clamp score between 0 and 1
  score = Math.min(1, Math.max(0, score));

  // Estimate total tokens (rough: 4 chars per token)
  const estimatedInputTokens = Math.ceil((message.length + historyTokens * 4) / 4);
  const estimatedOutputTokens = estimateOutputTokens(detectedTaskType, estimatedInputTokens);

  return {
    score,
    reason: reasons.length > 0 ? reasons.join(', ') : 'Simple task',
    estimatedTokens: estimatedInputTokens + estimatedOutputTokens,
    taskType: detectedTaskType,
  };
}
