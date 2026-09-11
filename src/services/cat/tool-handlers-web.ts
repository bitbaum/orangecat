/**
 * Dispatch for Cat's two web tools.
 *
 * Separate from `tool-executor.ts` because that file is within twenty lines of
 * the 500-line service ceiling, and because these two share one piece of state
 * the other tools have no business touching: the per-turn URL allow-list in
 * `WebTurnContext`. Keeping them together keeps that invariant readable —
 * a search WIDENS what may be read, and nothing else does.
 */
import { searchTheWeb, readTheWeb, type WebTurnContext } from './web-research';
import type { OnToolCall, RawToolCall, ToolResultMessage } from './tool-use-types';

export const WEB_TOOL_NAMES = ['web_search', 'read_page'] as const;
export type WebToolName = (typeof WEB_TOOL_NAMES)[number];

export function isWebTool(name: string | undefined): name is WebToolName {
  return WEB_TOOL_NAMES.includes(name as WebToolName);
}

function parseArgs<T>(toolCall: RawToolCall): Partial<T> {
  try {
    return JSON.parse(toolCall.function?.arguments ?? '{}') as Partial<T>;
  } catch {
    return {};
  }
}

export async function executeWebTool(
  toolCall: RawToolCall,
  web: WebTurnContext | undefined,
  onToolCall?: OnToolCall
): Promise<ToolResultMessage> {
  const name = toolCall.function?.name as WebToolName;

  // No context means no allow-list, and an unbounded reader is exactly what the
  // allow-list exists to prevent. Refusing is the safe failure; a tool that
  // quietly works without its guard is the unsafe one.
  if (!web) {
    onToolCall?.({ id: toolCall.id, name, status: 'failed', error: 'no_web_context' });
    return {
      role: 'tool',
      tool_call_id: toolCall.id,
      content:
        'The web is not available on this request. Answer from what you already know, and say plainly that you could not look anything up.',
    };
  }

  // Marked before the call, not after: a lookup that dies on the phase
  // deadline never reaches its own success branch, and that is precisely the
  // turn the fallback needs to know about.
  web.attempted = true;

  if (name === 'web_search') {
    const args = parseArgs<{ query: string; site: string }>(toolCall);
    const query = typeof args.query === 'string' ? args.query : '';
    onToolCall?.({ id: toolCall.id, name, status: 'running', args: { query, site: args.site } });

    const outcome = await searchTheWeb(web, {
      query,
      ...(typeof args.site === 'string' && args.site ? { site: args.site } : {}),
    });

    if (!outcome.ok) {
      // `no_results` and `failed` are different chips on purpose: one says the
      // web had nothing, the other says we never got to look, and a user
      // deciding whether to trust the reply needs to know which. The same
      // distinction the tool result makes to the model, made to the person.
      if (outcome.searched) {
        onToolCall?.({ id: toolCall.id, name, status: 'no_results' });
      } else {
        onToolCall?.({ id: toolCall.id, name, status: 'failed', error: 'search_unavailable' });
      }
    } else {
      onToolCall?.({
        id: toolCall.id,
        name,
        status: 'completed',
        resultCount: outcome.results.length,
        results: outcome.results.map(r => ({ url: r.url, type: 'web', title: r.title })),
      });
    }
    return { role: 'tool', tool_call_id: toolCall.id, content: outcome.content };
  }

  const args = parseArgs<{ url: string }>(toolCall);
  const url = typeof args.url === 'string' ? args.url : '';
  onToolCall?.({ id: toolCall.id, name, status: 'running', args: { url } });

  const outcome = await readTheWeb(web, { url });
  if (!outcome.ok) {
    onToolCall?.({ id: toolCall.id, name, status: 'failed', error: 'page_unavailable' });
  } else {
    onToolCall?.({
      id: toolCall.id,
      name,
      status: 'completed',
      resultCount: 1,
      results: outcome.results.map(r => ({ url: r.url, type: 'web', title: r.title })),
    });
  }
  return { role: 'tool', tool_call_id: toolCall.id, content: outcome.content };
}
