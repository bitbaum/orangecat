/**
 * Shared AI provider contract.
 *
 * The minimal interface every platform AI service (Groq, OpenRouter, …) satisfies.
 * Single source of truth — this was previously declared verbatim in BOTH
 * services/ai/platform-providers.ts and services/cat/provider-resolver.ts, so a
 * change to the contract (e.g. costBtc semantics) had to be made in two places or
 * they'd drift.
 */
export interface AiService {
  streamChatCompletion(opts: {
    model: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- providers declare text-only messages but the Cat sends image parts and tool turns; needs each provider's message type widened
    messages: any[];
    temperature: number;
  }): AsyncIterable<{ content?: string; usage?: unknown; done?: boolean }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see streamChatCompletion above
  chatCompletion(opts: { model: string; messages: any[]; temperature: number }): Promise<{
    content: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    isFreeModel: boolean;
    usedByok: boolean;
    costBtc?: number;
  }>;
}
