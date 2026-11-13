/**
 * One reply on the person's own key, with the plumbing its model was trained on.
 *
 * The model's profile (config/model-profiles.ts) decides how the bot's hands
 * are offered: as functions in the provider's native format where the model
 * takes them, as the `propose` fence in prose where it does not. Either way
 * the reply that leaves here is words that may end in that fence
 * (companions/native-tools.ts), so nothing after the model call can tell.
 *
 * A provider that refuses the functions is asked once more in prose, which
 * every model reads: a wrong profile costs one retry, not a failed turn.
 */
import type { CatAction } from '@/config/cat-actions';
import { modelProfile } from '@/config/model-profiles';
import { replyFromNative, toNativeMessages, toolsFor } from '@/services/companions/native-tools';
import { logger } from '@/utils/logger';

import type { AiService } from './types';

type Turn = { role: string; content: unknown };
type Reply = Awaited<ReturnType<AiService['chatCompletion']>>;

/** A refusal that is about the functions offered, not about the key, the balance or the rate. */
export function toolsWereRefused(error: unknown): boolean {
  const said = error instanceof Error ? error.message : '';
  if (/\b(401|402|403|429)\b|credit|balance|quota|rate.?limit/i.test(said)) {
    return false;
  }
  return /tool|function|schema|\b(400|422)\b|unsupported|invalid/i.test(said);
}

export async function replyOnOwnKey<M extends Turn>(input: {
  service: AiService;
  provider: string;
  /** The model chosen for this chat, or '' for the one the key's holder chose. */
  model: string;
  systemPrompt: string | null;
  messages: M[];
  temperature: number;
  maxTokens?: number;
  /** The hands as functions, and the prompt written for a model given them that way. */
  native?: { actions: readonly CatAction[]; systemPrompt: string | null };
  /** Carries on an answer the output cap cut (sendMessage-internals finishCutOffReply). */
  finish: (first: Reply, more: (turns: M[]) => Promise<Reply>, messages: M[]) => Promise<Reply>;
}): Promise<{ whole: Reply; model: string }> {
  const { service, model, messages, temperature, maxTokens } = input;
  const native =
    input.native?.actions.length && modelProfile(input.provider, model).nativeTools
      ? input.native
      : null;

  const run = (mode: typeof native) => {
    // The system prompt travels as the first message, as on the platform
    // chain: every OpenAI-compatible vendor accepts that.
    const prompt = mode ? mode.systemPrompt : input.systemPrompt;
    const system = (turns: Turn[]): Turn[] =>
      prompt ? [{ role: 'system', content: prompt }, ...turns] : turns;
    const ask = async (turns: M[]): Promise<Reply> => {
      const result = await service.chatCompletion({
        model,
        messages: mode ? toNativeMessages(system(turns)) : system(turns),
        temperature,
        maxTokens,
        ...(mode ? { tools: toolsFor(mode.actions) } : {}),
      });
      return mode
        ? { ...result, content: replyFromNative(result.content, result.toolCalls, mode.actions) }
        : result;
    };
    return ask(messages).then(first => input.finish(first, ask, messages));
  };

  try {
    return { whole: await run(native), model };
  } catch (error: unknown) {
    if (!native || !toolsWereRefused(error)) {
      throw error;
    }
    logger.warn(
      'native tools refused; asked again in prose',
      { provider: input.provider, model },
      'AIMessagesService'
    );
    return { whole: await run(null), model };
  }
}
