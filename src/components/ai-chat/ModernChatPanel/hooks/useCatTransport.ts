/**
 * The Cat's one job inside chatkit's ChatApp: answer a turn.
 *
 * ChatApp owns the chat list, New chat, Temporary chat, the queue, Stop and
 * Retry; this hook is what it calls with each turn (`ChatTransport`). It
 * speaks the Cat's own routes — the streamed `/api/cat/chat`, or, for a model
 * on the person's computer, `/api/cat/prepare` and the local loop — and hands
 * back the answer with what the Cat did on the way (tool calls, actions,
 * drafts) for the footer under it.
 *
 * Temporary chats: ChatApp keeps them off the store and sends
 * `conversationId: null`. The server still needs a thread to read the turn's
 * history from, so a temporary chat gets an unlisted row (`ephemeral`, never
 * read into memory, swept after a day by the cleanup cron) that is deleted
 * the moment the person leaves it — `leaveTemporary`, called by the panel —
 * or the page.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Attachment } from '@bitbaum/chatkit';
import type { ChatTransport, ChatTurn, ChatTurnResult } from '@bitbaum/chatkit/react';
import { readEventStream } from '@/lib/sse';
import { logger } from '@/utils/logger';
import { API_ROUTES } from '@/config/api-routes';
import { isCatHubPath } from '@/config/routes';
import { useUserCurrency } from '@/hooks/useUserCurrency';
import { STORAGE_KEYS } from '@/config/storage-keys';
import { readPageExcerptForCat, type CatPageDescriptor } from '@/config/cat-page-context';
import { getLocalRuntime, parseLocalModelId } from '@/config/local-ai';
import type { CatReference } from '@/config/cat-prompts';
import { runLocalTurn } from '@/services/ai/local-turn';
import { labelForTool } from '@/lib/chat/tool-labels';
import { catAnswer, type CatTurnExtras, type FallbackNotice } from '@/lib/chat/cat-messages';
import { composeMessage, imagesOf, type ChatAttachment } from '../attachments';
import type { CatAction, ExecActionResult, PrefillProposal, ToolCallEvent } from '../types';

/** Why the last turn failed, in the server's words, with its code (drives the fix links). */
export interface CatTurnFailure {
  message: string;
  code: string | null;
}

class CatChatError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

const STREAM_TIMEOUT_MS = 60_000;
const TIMED_OUT = 'Response timed out. Try again or rephrase your question.';

/**
 * The page the person came FROM before the Cat. Same-origin only; the
 * sessionStorage breadcrumb (route-tracker) first, then the referrer.
 */
function readLastVisitedPath(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEYS.LAST_VISITED_PATH);
    if (stored && stored.startsWith('/') && !isCatHubPath(stored)) {
      return stored;
    }
  } catch {
    /* sessionStorage may be unavailable; fall through */
  }
  try {
    const ref = new URL(document.referrer);
    if (ref.origin !== window.location.origin || isCatHubPath(ref.pathname)) {
      return undefined;
    }
    return ref.pathname;
  } catch {
    return undefined;
  }
}

function readLocale(): string {
  return typeof navigator === 'undefined' ? 'en-US' : navigator.language || 'en-US';
}

/** chatkit's staged files as the Cat's: photos travel beside the message,
 *  text files and the person's own things inside it (see ../attachments). */
function toCatAttachments(list: Attachment[], refs: CatReference[]): ChatAttachment[] {
  return [
    ...list.map((a, i): ChatAttachment =>
      a.kind === 'image'
        ? {
            kind: 'image',
            id: `img-${i}`,
            name: a.name,
            dataUrl: `data:${a.mimeType};base64,${a.dataBase64}`,
          }
        : { kind: 'file', id: `file-${i}`, name: a.name, content: a.content }
    ),
    ...refs.map((ref, i): ChatAttachment => ({ kind: 'ref', id: `ref-${i}`, ref })),
  ];
}

/** Merge a tool-call event into the turn's list: same id replaces, else appends. */
function mergeToolCall(list: ToolCallEvent[], event: ToolCallEvent): ToolCallEvent[] {
  const idx = list.findIndex(t => t.id === event.id);
  return idx >= 0 ? list.map((t, i) => (i === idx ? event : t)) : [...list, event];
}

/** The steps line while the answer streams: what the Cat is doing, in words. */
function stepsOf(calls: ToolCallEvent[]) {
  return calls.map(c => {
    const words = labelForTool(c.name);
    switch (c.status) {
      case 'running':
        return { label: words.running };
      case 'completed':
        return { label: words.completed(c.resultCount) };
      case 'no_results':
        return { label: words.noResults };
      case 'failed':
        return { label: words.failed };
      default:
        return { label: words.running };
    }
  });
}

async function createServerConversation(ephemeral: boolean): Promise<string | null> {
  try {
    const res = await fetch(API_ROUTES.CAT.CONVERSATIONS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ephemeral }),
    });
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    return data?.data?.id ?? null;
  } catch (err) {
    logger.warn('Failed to create a temporary conversation', { err }, 'useCatTransport');
    return null;
  }
}

interface UseCatTransportOptions {
  /** The model picked in the composer ('auto' = the route decides). */
  model: string;
  /** The page behind the Cat, when it runs over one (GlobalCatLauncher). */
  pageContext?: CatPageDescriptor | null;
  /** The person's own things staged for this message; taken (and cleared) per send. */
  takeReferences: () => CatReference[];
  /** After every turn, answered or not (quota meter, memory notes). */
  onSettled?: () => void;
  /** The answer left an action waiting for the person's confirmation. */
  onPendingConfirmation?: () => void;
}

export function useCatTransport({
  model,
  pageContext,
  takeReferences,
  onSettled,
  onPendingConfirmation,
}: UseCatTransportOptions) {
  const preferredCurrency = useUserCurrency();
  const [failure, setFailure] = useState<CatTurnFailure | null>(null);

  // Read at send time, so a turn always uses what is on screen now.
  const live = useRef({
    model,
    pageContext,
    preferredCurrency,
    takeReferences,
    onSettled,
    onPendingConfirmation,
  });
  live.current = {
    model,
    pageContext,
    preferredCurrency,
    takeReferences,
    onSettled,
    onPendingConfirmation,
  };

  // The open temporary chat's unlisted server row, and whether a turn of it
  // is running (a row is never deleted under its own turn).
  const temporary = useRef<{ id: string | null; running: boolean }>({ id: null, running: false });

  const leaveTemporary = useCallback(() => {
    const { id, running } = temporary.current;
    if (!id || running) {
      return;
    }
    temporary.current.id = null;
    // keepalive: a closing tab still gets it out; the daily sweep is the net.
    void fetch(API_ROUTES.CAT.CONVERSATION(id), { method: 'DELETE', keepalive: true }).catch(
      () => undefined
    );
  }, []);

  useEffect(() => {
    window.addEventListener('pagehide', leaveTemporary);
    return () => {
      window.removeEventListener('pagehide', leaveTemporary);
      leaveTemporary();
    };
  }, [leaveTemporary]);

  /** The server thread this turn belongs to (null = the server's default). */
  const threadFor = async (turn: ChatTurn): Promise<string | null> => {
    if (!turn.temporary) {
      leaveTemporary();
      return turn.conversationId;
    }
    if (turn.history.length === 0 || !temporary.current.id) {
      // A new temporary chat (or its first turn again, after a failure).
      leaveTemporary();
      const id = await createServerConversation(true);
      if (!id) {
        // Never fall back to the default thread: that would keep it.
        throw new CatChatError('The temporary chat could not start. Try again.', 'STREAM_ERROR');
      }
      temporary.current.id = id;
    }
    return temporary.current.id;
  };

  const transport: ChatTransport = useCallback(async (turn: ChatTurn): Promise<ChatTurnResult> => {
    const now = live.current;
    setFailure(null);
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), STREAM_TIMEOUT_MS);
    // Stop (ChatApp's signal) or the timeout, whichever comes first.
    turn.signal.addEventListener('abort', () => timeout.abort(), { once: true });
    const signal = timeout.signal;
    if (turn.temporary) {
      temporary.current.running = true;
    }

    let text = '';
    let toolCalls: ToolCallEvent[] = [];
    const show = () => turn.update({ text, steps: toolCalls.length ? stepsOf(toolCalls) : [] });

    try {
      const attachments = toCatAttachments(turn.attachments, now.takeReferences());
      const message = composeMessage(turn.text, attachments);
      const images = imagesOf(attachments);
      const conversationId = await threadFor(turn);
      const context = {
        preferredCurrency: now.preferredCurrency,
        locale: readLocale(),
        lastVisitedPath: readLastVisitedPath(),
        currentPath: now.pageContext?.path,
        currentEntity: now.pageContext?.entity,
        // What the person sees, captured fresh each send — without it the Cat
        // knows the path but invents the page's contents.
        pageExcerpt: now.pageContext?.path ? readPageExcerptForCat() : undefined,
        conversationId: conversationId ?? undefined,
      };

      // ── A model on the person's own computer ─────────────────────────────
      const local = parseLocalModelId(now.model);
      if (local) {
        if (images.length) {
          // The local path sends text only; dropping the photo silently would
          // get an answer about nothing.
          throw new CatChatError(
            'Your local model can’t see photos. Switch to Auto to send a photo, or describe it in words.',
            'NO_VISION_MODEL'
          );
        }
        const prepRes = await fetch(API_ROUTES.CAT.PREPARE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, ...context }),
          signal,
        });
        const prepared = prepRes.ok
          ? (
              (await prepRes.json()) as {
                data?: {
                  messages?: Array<{ role: string; content: string }>;
                  conversationId?: string | null;
                };
              }
            ).data
          : undefined;
        if (!prepared?.messages?.length) {
          throw new CatChatError('Could not prepare your conversation. Try again.', 'STREAM_ERROR');
        }
        let result;
        try {
          // The loop, not a single shot: each pass streams, the server runs
          // what it asked for, and the model writes its reply last.
          result = await runLocalTurn({
            runtimeId: local.runtimeId,
            model: local.model,
            conversationId: prepared.conversationId ?? null,
            userMessage: message,
            messages: prepared.messages,
            signal,
            onChunk: chunk => {
              text += chunk;
              show();
            },
            onReplaceContent: settled => {
              text = settled;
              show();
            },
            onToolCall: event => {
              toolCalls = mergeToolCall(toolCalls, event);
              show();
            },
          });
        } catch (localErr) {
          if (signal.aborted) {
            throw localErr;
          }
          const runtimeName = getLocalRuntime(local.runtimeId)?.name ?? local.runtimeId;
          throw new CatChatError(
            `Cat can't reach ${runtimeName} on this computer. Make sure it's running with OrangeCat allowed (Settings → AI → Run locally shows the exact command), then try again.`,
            'LOCAL_UNREACHABLE'
          );
        }
        return catAnswer({
          content:
            result.message.trim() ||
            "I couldn't put together a reply to that. Could you rephrase or add a bit more detail?",
          quickReplies: result.quickReplies,
          toolCalls: toolCalls.length ? toolCalls : undefined,
          modelUsed: now.model,
          provider: 'local',
          at: new Date().toISOString(),
        });
      }

      // ── The Cat's own route ──────────────────────────────────────────────
      const res = await fetch(API_ROUTES.CAT.CHAT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          images: images.length ? images : undefined,
          model: now.model !== 'auto' ? now.model : undefined,
          stream: true,
          ...context,
        }),
        signal,
      });
      if (!res.ok || !res.body) {
        let msg = 'Failed to get response';
        let code: string | undefined;
        try {
          const data = await res.json();
          // standardResponse: { success:false, error:{code,message} }; older
          // shapes after it, so anything truthy beats the generic default.
          msg =
            data?.message ||
            data?.error?.message ||
            data?.details?.message ||
            (typeof data?.error === 'string' ? data.error : undefined) ||
            msg;
          code = data?.code || data?.error?.code;
        } catch {}
        throw new CatChatError(msg, code);
      }

      const extras: CatTurnExtras = { modelUsed: now.model };
      let quickReplies: string[] | undefined;
      await readEventStream(res.body, (json: unknown) => {
        const event = json as {
          content?: string;
          done?: boolean;
          model?: string;
          provider?: string;
          actions?: CatAction[];
          /** Server-repaired reply — replaces what streamed (services/cat/grounding.ts). */
          correctedContent?: string;
          execResults?: ExecActionResult[];
          quickReplies?: string[];
          tool_call?: ToolCallEvent;
          prefill_proposal?: PrefillProposal;
          fallback?: FallbackNotice;
          suggestUpgrade?: boolean;
          error?: string;
          code?: string;
        };
        if (event?.error) {
          throw new CatChatError(event.error, event.code);
        }
        if (event?.content) {
          text += event.content;
          show();
        }
        if (event?.model) {
          extras.modelUsed = event.model;
        }
        if (event?.provider) {
          extras.provider = event.provider;
        }
        if (event?.actions) {
          extras.actions = event.actions;
        }
        if (event?.execResults) {
          extras.execResults = event.execResults;
        }
        if (event?.quickReplies) {
          quickReplies = event.quickReplies;
        }
        if (event?.tool_call) {
          toolCalls = mergeToolCall(toolCalls, event.tool_call);
          show();
        }
        if (event?.prefill_proposal) {
          extras.prefillProposals = [...(extras.prefillProposals ?? []), event.prefill_proposal];
        }
        if (event?.fallback) {
          extras.fallback = event.fallback;
        }
        if (event?.done && event.suggestUpgrade) {
          extras.suggestUpgrade = true;
        }
        // The server checked the finished reply against the person's own data
        // and dropped what it did not support; the screen must say the same
        // as the stored conversation.
        if (event?.done && event.correctedContent) {
          text = event.correctedContent;
          show();
        }
      });

      if (extras.execResults?.some(r => r.status === 'pending_confirmation')) {
        now.onPendingConfirmation?.();
      }
      return catAnswer({
        ...extras,
        content: text,
        quickReplies,
        toolCalls: toolCalls.length ? toolCalls : undefined,
        at: new Date().toISOString(),
      });
    } catch (e) {
      if (turn.signal.aborted) {
        // Stopped by the person: ChatApp keeps what had arrived.
        throw e;
      }
      if (signal.aborted) {
        if (text.trim()) {
          // A slow answer that got somewhere is kept, not thrown away.
          return catAnswer({ content: text, toolCalls: toolCalls.length ? toolCalls : undefined });
        }
        setFailure({ message: TIMED_OUT, code: null });
        throw e;
      }
      setFailure({
        message: e instanceof Error ? e.message : 'Something went wrong',
        code: e instanceof CatChatError ? (e.code ?? null) : null,
      });
      throw e;
    } finally {
      clearTimeout(timer);
      if (turn.temporary) {
        temporary.current.running = false;
      }
      live.current.onSettled?.();
    }
    // `threadFor` reads only refs; the transport is stable for ChatApp.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { transport, failure, leaveTemporary };
}
