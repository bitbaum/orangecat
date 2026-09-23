import type { RawToolCall, ToolAugmentedMessage, ToolResultMessage } from './tool-use-types';

/** Bounded conversational context for follow-ups, excluding system prompts and tool payloads. */
export function toolRoutingHistory(messages: ToolAugmentedMessage[], userMessage: string) {
  const dialogue = messages.filter(
    m =>
      (m.role === 'user' || m.role === 'assistant') &&
      !('tool_calls' in m) &&
      typeof m.content === 'string' &&
      m.content.trim()
  );
  // The caller already appends the current request after this history.
  if (dialogue.at(-1)?.role === 'user' && dialogue.at(-1)?.content === userMessage) {
    dialogue.pop();
  }
  return dialogue.slice(-8).map(m => ({
    role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
    content: (m.content as string).slice(0, 2000),
  }));
}

/** Completed exchanges survive a deadline; an unfinished call is never presented as success. */
export class ToolTurnState {
  readonly controller = new AbortController();
  readonly completed: ToolAugmentedMessage[] = [];
  pending: RawToolCall | null = null;
  webEvidence: string[] = [];

  record(call: RawToolCall, result: ToolResultMessage, evidence: string[] = []) {
    if (this.controller.signal.aborted) {
      return;
    }
    this.completed.push({ role: 'assistant', content: null, tool_calls: [call] }, result);
    this.pending = null;
    this.webEvidence = [...evidence];
  }

  interrupted(messages: ToolAugmentedMessage[]): ToolAugmentedMessage[] {
    return [
      ...messages,
      ...this.completed,
      {
        role: 'system',
        content:
          'The tool phase stopped before it finished. Preserve and use the completed results above. ' +
          (this.pending
            ? `The outcome of ${this.pending.function.name} is unconfirmed; it may still finish. Do not claim success or failure, or retry a write without checking its status. `
            : '') +
          'Explain what was verified and what remains unfinished. Do not invent missing results.',
      },
    ];
  }
}
