import { useCallback, useEffect, useRef, useState } from 'react';
import { readEventStream } from '@/lib/sse';
import { logger } from '@/utils/logger';
import { API_ROUTES } from '@/config/api-routes';
import { isCatHubPath } from '@/config/routes';
import { useUserCurrency } from '@/hooks/useUserCurrency';
import { STORAGE_KEYS } from '@/config/storage-keys';
import { readPageExcerptForCat, type CatPageDescriptor } from '@/config/cat-page-context';
import { getLocalRuntime, parseLocalModelId } from '@/config/local-ai';
import { runLocalTurn } from '@/services/ai/local-turn';
import type {
  Message,
  CatAction,
  ExecActionResult,
  ToolCallEvent,
  PrefillProposal,
} from '../types';
import { useChatHistory } from './useChatHistory';

/** Chat error that carries the server's machine-readable code (drives recovery CTAs). */
class CatChatError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

const STREAM_TIMEOUT_MS = 60_000;

/**
 * Collect the page the user navigated FROM before reaching Cat. Same-origin only.
 * Returns undefined when there's no usable referrer (direct nav, cross-origin, etc.).
 */
function readLastVisitedPath(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  // Prefer the sessionStorage breadcrumb (set by route-tracker) when present —
  // it survives refresh and direct cat-page loads. Falls back to document.referrer.
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEYS.LAST_VISITED_PATH);
    if (stored && stored.startsWith('/') && !isCatHubPath(stored)) {
      return stored;
    }
  } catch {
    /* sessionStorage may be unavailable; fall through */
  }
  const ref = document.referrer;
  if (!ref) {
    return undefined;
  }
  try {
    const refUrl = new URL(ref);
    if (refUrl.origin !== window.location.origin) {
      return undefined;
    }
    if (isCatHubPath(refUrl.pathname)) {
      return undefined;
    }
    return refUrl.pathname;
  } catch {
    return undefined;
  }
}

function readLocale(): string {
  if (typeof navigator === 'undefined') {
    return 'en-US';
  }
  return navigator.language || 'en-US';
}

interface UseChatMessagesOptions {
  selectedModel: string;
  /** Active conversation. Omitted/null → fresh draft; a conversation is created on first send. */
  conversationId?: string | null;
  onPendingResult?: () => void;
  /**
   * Fires once per send attempt after the request settles (success, error,
   * or abort). Used to refresh the quota meter so the visible count tracks
   * the platform's daily counter without a page reload.
   */
  onMessageSent?: () => void;
  /**
   * Fires after the FIRST message of a brand-new conversation is sent, so the
   * rail can refresh (the conversation gets its auto-title server-side).
   */
  onConversationStarted?: () => void;
  /**
   * Fires when the first send of a fresh draft lazily created a conversation,
   * so the owner can adopt it (highlight in the rail, route later sends to it).
   */
  onConversationCreated?: (id: string) => void;
  /**
   * The page the user is currently on, when Cat runs as a global overlay. Sent
   * with each message so Cat knows what the user is looking at. Omitted on the
   * standalone Cat hub (there is no "page behind" it).
   */
  pageContext?: CatPageDescriptor | null;
}

/** Create a conversation row on the server; null on failure (send falls back to default). */
async function createConversationOnServer(): Promise<string | null> {
  try {
    const res = await fetch(API_ROUTES.CAT.CONVERSATIONS, { method: 'POST' });
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    return data?.data?.id ?? null;
  } catch (err) {
    logger.warn('Failed to create conversation', { err }, 'useChatMessages');
    return null;
  }
}

export function useChatMessages({
  selectedModel,
  conversationId,
  onPendingResult,
  onMessageSent,
  onConversationStarted,
  onConversationCreated,
  pageContext,
}: UseChatMessagesOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const onPendingResultRef = useRef(onPendingResult);
  onPendingResultRef.current = onPendingResult;
  const onMessageSentRef = useRef(onMessageSent);
  onMessageSentRef.current = onMessageSent;
  const onConversationStartedRef = useRef(onConversationStarted);
  onConversationStartedRef.current = onConversationStarted;
  const onConversationCreatedRef = useRef(onConversationCreated);
  onConversationCreatedRef.current = onConversationCreated;
  // Live page context — read at send time so navigating with Cat open stays current.
  const pageContextRef = useRef(pageContext);
  pageContextRef.current = pageContext;
  const preferredCurrency = useUserCurrency();

  // Conversation created lazily on the first send of a fresh draft. `pending`
  // routes follow-up sends until the owner adopts the id into the prop;
  // `justCreated` tells useChatHistory to skip the one refetch that adoption
  // triggers (the live thread is already in state).
  const pendingConversationIdRef = useRef<string | null>(null);
  const justCreatedConversationIdRef = useRef<string | null>(null);

  // Any change of the active conversation (including → null for "New chat")
  // invalidates the pending draft id.
  useEffect(() => {
    pendingConversationIdRef.current = null;
  }, [conversationId]);

  const { isLoadingHistory } = useChatHistory(
    setMessages,
    conversationId,
    justCreatedConversationIdRef
  );

  // Streaming appends a new `messages` array on every token, so this fires
  // dozens of times per reply. Auto-follow only while already near the
  // bottom — otherwise a smooth scrollIntoView on every token yanks the
  // thread back down each time the user scrolls up to read earlier
  // messages, which reads as the whole panel being scroll-locked/stuck.
  useEffect(() => {
    const sentinel = messagesEndRef.current;
    const scrollContainer = sentinel?.closest<HTMLElement>('.oc-chat-scroll');
    if (!scrollContainer) {
      sentinel?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    const distanceFromBottom =
      scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight;
    if (distanceFromBottom < 120) {
      sentinel?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) {
        return;
      }

      setError(null);
      setErrorCode(null);

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMessage]);
      setIsLoading(true);

      // Fresh draft: create the conversation now (first send), so every new
      // chat is its own thread instead of piling into the default one. On
      // failure we send without an id and the server falls back to default.
      let activeConversationId = conversationId ?? pendingConversationIdRef.current;
      if (!activeConversationId) {
        const created = await createConversationOnServer();
        if (created) {
          pendingConversationIdRef.current = created;
          justCreatedConversationIdRef.current = created;
          activeConversationId = created;
          onConversationCreatedRef.current?.(created);
        }
      }

      const assistantId = `assistant-${Date.now()}`;
      setMessages(prev => [
        ...prev,
        { id: assistantId, role: 'assistant', content: '', timestamp: new Date() },
      ]);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      const timeout = setTimeout(() => abortController.abort(), STREAM_TIMEOUT_MS);

      try {
        // ── Local model path ──────────────────────────────────────────────
        // Inference runs on the USER's machine (Ollama / LM Studio); the
        // server only prepares Cat's context and persists the exchange.
        const local = parseLocalModelId(selectedModel);
        if (local) {
          const prepRes = await fetch(API_ROUTES.CAT.PREPARE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: content,
              preferredCurrency,
              locale: readLocale(),
              lastVisitedPath: readLastVisitedPath(),
              currentPath: pageContextRef.current?.path,
              currentEntity: pageContextRef.current?.entity,
              pageExcerpt: pageContextRef.current?.path ? readPageExcerptForCat() : undefined,
              conversationId: activeConversationId ?? undefined,
            }),
            signal: abortController.signal,
          });
          if (!prepRes.ok) {
            throw new CatChatError(
              'Could not prepare your conversation. Try again.',
              'STREAM_ERROR'
            );
          }
          const prepBody = (await prepRes.json()) as {
            data?: {
              messages?: Array<{ role: string; content: string }>;
              conversationId?: string | null;
            };
          };
          const prepared = prepBody?.data;
          if (!prepared?.messages?.length) {
            throw new CatChatError(
              'Could not prepare your conversation. Try again.',
              'STREAM_ERROR'
            );
          }

          // The loop, not a single shot. `runLocalTurn` streams a pass into
          // the bubble, posts it to the server (which parses the envelope and
          // RUNS the action), feeds the outcome back, and lets the model write
          // its reply last — knowing what happened rather than guessing.
          //
          // The reply is no longer posted fire-and-forget. That discarded the
          // results, so the server executed into a void and the user watched a
          // raw exec_action block scroll past as JSON.
          let turn;
          try {
            turn = await runLocalTurn({
              runtimeId: local.runtimeId,
              model: local.model,
              conversationId: prepared.conversationId ?? null,
              userMessage: content,
              messages: prepared.messages,
              signal: abortController.signal,
              onChunk: chunk =>
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantId ? { ...m, content: (m.content || '') + chunk } : m
                  )
                ),
              // Each pass settles the bubble to the parsed text, so the
              // envelope never stays on screen.
              onReplaceContent: text =>
                setMessages(prev =>
                  prev.map(m => (m.id === assistantId ? { ...m, content: text } : m))
                ),
              onToolCall: event =>
                setMessages(prev =>
                  prev.map(m => {
                    if (m.id !== assistantId) {
                      return m;
                    }
                    const existing = m.toolCalls ?? [];
                    const idx = existing.findIndex(t => t.id === event.id);
                    return {
                      ...m,
                      toolCalls:
                        idx >= 0
                          ? existing.map((t, i) => (i === idx ? event : t))
                          : [...existing, event],
                    };
                  })
                ),
            });
          } catch (localErr) {
            if (localErr instanceof DOMException && localErr.name === 'AbortError') {
              throw localErr;
            }
            const runtimeName = getLocalRuntime(local.runtimeId)?.name ?? local.runtimeId;
            throw new CatChatError(
              `Cat can't reach ${runtimeName} on this computer. Make sure it's running with OrangeCat allowed (Settings → AI → Run locally shows the exact command), then try again.`,
              'LOCAL_UNREACHABLE'
            );
          }

          if (!turn.message.trim()) {
            const fallback =
              "I couldn't put together a reply to that. Could you rephrase or add a bit more detail?";
            setMessages(prev =>
              prev.map(m => (m.id === assistantId ? { ...m, content: fallback } : m))
            );
          }

          setMessages(prev =>
            prev.map(m =>
              m.id === assistantId
                ? {
                    ...m,
                    modelUsed: selectedModel,
                    provider: 'local',
                    quickReplies: turn.quickReplies,
                  }
                : m
            )
          );
          return;
        }

        const res = await fetch(API_ROUTES.CAT.CHAT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: content,
            model: selectedModel !== 'auto' ? selectedModel : undefined,
            stream: true,
            preferredCurrency,
            locale: readLocale(),
            lastVisitedPath: readLastVisitedPath(),
            currentPath: pageContextRef.current?.path,
            currentEntity: pageContextRef.current?.entity,
            // What the user actually sees, captured fresh each send — without
            // it Cat knows the path but invents the page's contents.
            pageExcerpt: pageContextRef.current?.path ? readPageExcerptForCat() : undefined,
            conversationId: activeConversationId ?? undefined,
          }),
          signal: abortController.signal,
        });

        if (!res.ok || !res.body) {
          let msg = 'Failed to get response';
          let code: string | undefined;
          try {
            const data = await res.json();
            // standardResponse envelope: { success:false, error:{code,message,details} }.
            // Prefer error.message; fall back through legacy shapes so anything
            // truthy beats the generic default.
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

        let modelUsed = selectedModel;
        let providerUsed: string | undefined;
        let actions: CatAction[] | undefined;
        let execResults: ExecActionResult[] | undefined;
        let quickReplies: string[] | undefined;
        let suggestUpgrade = false;

        await readEventStream(res.body, (json: unknown) => {
          const event = json as {
            content?: string;
            done?: boolean;
            usage?: unknown;
            model?: string;
            provider?: string;
            actions?: CatAction[];
            /** Server-repaired reply — replaces what streamed. See services/cat/grounding.ts. */
            correctedContent?: string;
            execResults?: ExecActionResult[];
            quickReplies?: string[];
            tool_call?: ToolCallEvent;
            prefill_proposal?: PrefillProposal;
            fallback?: { from: string; to: string; model: string; reason: string };
            suggestUpgrade?: boolean;
            error?: string;
            code?: string;
          };
          if (event?.error) {
            throw new CatChatError(event.error, event.code);
          }
          if (event?.content) {
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantId ? { ...m, content: (m.content || '') + event.content } : m
              )
            );
          }
          if (event?.model) {
            modelUsed = event.model;
          }
          if (event?.provider) {
            providerUsed = event.provider;
          }
          if (event?.actions) {
            actions = event.actions;
          }
          if (event?.execResults) {
            execResults = event.execResults;
          }
          if (event?.quickReplies) {
            quickReplies = event.quickReplies;
          }
          if (event?.tool_call) {
            const toolEvent = event.tool_call;
            setMessages(prev =>
              prev.map(m => {
                if (m.id !== assistantId) {
                  return m;
                }
                const existing = m.toolCalls ?? [];
                // Merge: replace previous entry for the same tool-call id, else append.
                const idx = existing.findIndex(t => t.id === toolEvent.id);
                const next =
                  idx >= 0
                    ? existing.map((t, i) => (i === idx ? toolEvent : t))
                    : [...existing, toolEvent];
                return { ...m, toolCalls: next };
              })
            );
          }
          if (event?.prefill_proposal) {
            const proposal = event.prefill_proposal;
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantId
                  ? {
                      ...m,
                      prefillProposals: [...(m.prefillProposals ?? []), proposal],
                    }
                  : m
              )
            );
          }
          if (event?.fallback) {
            const notice = event.fallback;
            setMessages(prev =>
              prev.map(m => (m.id === assistantId ? { ...m, fallback: notice } : m))
            );
          }
          if (event?.done && event.suggestUpgrade) {
            suggestUpgrade = true;
          }
          // The server checked the finished reply against the user's own data
          // and rewrote it to drop claims that data did not support. Streaming
          // means the original already rendered, so swap it here — otherwise the
          // screen keeps a fabrication that the persisted conversation no longer
          // contains, and the two disagree on reload.
          if (event?.done && event.correctedContent) {
            const corrected = event.correctedContent;
            setMessages(prev =>
              prev.map(m => (m.id === assistantId ? { ...m, content: corrected } : m))
            );
          }
        });

        if (abortController.signal.aborted) {
          return;
        }

        if (execResults?.some(r => r.status === 'pending_confirmation')) {
          onPendingResultRef.current?.();
        }

        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId
              ? {
                  ...m,
                  modelUsed,
                  provider: providerUsed,
                  actions,
                  execResults,
                  quickReplies,
                  suggestUpgrade,
                }
              : m
          )
        );
      } catch (e) {
        const isAbort = e instanceof DOMException && e.name === 'AbortError';
        let hasPartialContent = false;
        setMessages(prev => {
          const assistant = prev.find(m => m.id === assistantId);
          hasPartialContent = !!assistant?.content?.trim();
          return prev;
        });

        if (isAbort && hasPartialContent) {
          // intentional no-op: keep partial streamed content
        } else if (isAbort) {
          setError('Response timed out. Try again or rephrase your question.');
          setErrorCode(null);
          setMessages(prev => prev.filter(m => m.id !== assistantId));
        } else {
          setError(e instanceof Error ? e.message : 'Something went wrong');
          setErrorCode(e instanceof CatChatError ? (e.code ?? null) : null);
          setMessages(prev => prev.filter(m => m.id !== assistantId));
        }
      } finally {
        clearTimeout(timeout);
        abortControllerRef.current = null;
        setIsLoading(false);
        onMessageSentRef.current?.();
        // Refresh the rail: titles (first message) + recency ordering.
        onConversationStartedRef.current?.();
      }
    },
    [isLoading, selectedModel, preferredCurrency, conversationId]
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
    setErrorCode(null);
    // A fresh draft has no server-side thread yet — nothing to clear there.
    const targetId = conversationId ?? pendingConversationIdRef.current;
    if (!targetId) {
      return;
    }
    const url = `${API_ROUTES.CAT.HISTORY}?conversationId=${encodeURIComponent(targetId)}`;
    fetch(url, { method: 'DELETE' }).catch((err: unknown) => {
      logger.warn('Failed to clear server history', { err }, 'useChatMessages');
    });
  }, [conversationId]);

  const setErrorState = useCallback((err: string | null) => {
    setError(err);
    setErrorCode(null);
  }, []);

  const addSystemMessage = useCallback((content: string) => {
    setMessages(prev => [
      ...prev,
      { id: `system-${Date.now()}`, role: 'assistant', content, timestamp: new Date() },
    ]);
  }, []);

  return {
    messages,
    isLoading,
    isLoadingHistory,
    error,
    messagesEndRef,
    sendMessage,
    stopGeneration,
    clearChat,
    setError: setErrorState,
    errorCode,
    addSystemMessage,
  };
}
