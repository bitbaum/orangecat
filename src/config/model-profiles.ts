/**
 * How each model is best spoken to: the plumbing, per model.
 *
 * A model is only as good as the way an app talks to it. Each one was trained
 * on its own provider's format for calling tools; offered tools that way it
 * uses them reliably, and handed a description in prose it guesses. A bot
 * here spoke to every model the same way, in prose, which is why the same
 * model did better in its maker's own app than in ours.
 *
 * A profile says what a model can take. The turn reads it and builds the
 * request for that model (services/companions/native-tools.ts). Unknown is
 * the careful answer: prose, which every model can read. A profile that
 * turns out wrong costs one retry, not a failed turn (sendMessage-internals
 * falls back to prose when a provider refuses the tools).
 */
export interface ModelProfile {
  /** Takes function definitions in the OpenAI-style `tools` field and answers with `tool_calls`. */
  nativeTools: boolean;
}

const PROSE: ModelProfile = { nativeTools: false };
const NATIVE: ModelProfile = { nativeTools: true };

/** Providers whose chat models take native tools unless a model is named below. */
const NATIVE_PROVIDERS = new Set([
  'xai',
  'openai',
  'anthropic',
  'deepseek',
  'groq',
  'mistral',
  'moonshot',
  'google',
]);

/** Models that do not take tools even at a provider that otherwise does. */
const NO_TOOLS = /(^|[-/])(o1-mini|o1-preview)|reasoner|guard|whisper|embed/i;

/** Model families that take native tools wherever they are served (Together, OpenRouter, Loki). */
const TOOL_FAMILIES =
  /grok|gpt-|claude|deepseek-chat|kimi|moonshot|qwen|mistral|llama-3\.[13]|llama-4|gemini/i;

export function modelProfile(provider: string, model: string | null | undefined): ModelProfile {
  const id = model ?? '';
  if (id && NO_TOOLS.test(id)) {
    return PROSE;
  }
  if (NATIVE_PROVIDERS.has(provider)) {
    return NATIVE;
  }
  return id && TOOL_FAMILIES.test(id) ? NATIVE : PROSE;
}
