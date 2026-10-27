'use client';

/**
 * THE CAT CHAT — chatkit's ChatApp with the Cat's transport and words.
 *
 * ChatApp is the whole app around a conversation, the same in every fleet
 * product: the header (Chats · title · New chat · "…" with Temporary chat,
 * Rename, Delete), the chat list (a drawer on a phone, a rail from 64rem)
 * with search and Today / Yesterday / Earlier, reopening the open chat after
 * a reload, the composer with Camera · Photos · Files and the microphone,
 * queueing a message typed while an answer runs, Stop and Retry.
 *
 * What is the Cat's own, and stays here:
 *   - the transport (useCatTransport): its routes, models, page context
 *   - the store (catConversationStore): its signed-in server rows
 *   - "Your things" as rows of chatkit's attach sheet (`attachExtras`), shown
 *     on the sent message (`chipsFor`), and the model picker
 *   - what it did, under each answer (CatAnswerFooter); "what next" only under
 *     the latest (`isLatest`)
 *   - actions waiting for a confirmation and memories it just noted, over
 *     the composer: they belong to the person, not to one chat, so they show
 *     on a new chat too (`thread.after` draws only inside a thread)
 *   - its greeting and opener over the starters
 *
 * Words from outside the composer (`?q=` and the Loki sheet's `askCat`) go
 * through ChatApp's own handle and deep link, the same path as typing.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChatApp, type ChatAppHandle, type RenderLink } from '@bitbaum/chatkit/react';
import '@bitbaum/chatkit/styles.css';
import { CAT_SEND_EVENT } from '@/lib/chat/cat-send-event';
import { postChatFeedback } from '@/lib/chat/feedback';
import { catConversationStore } from '@/lib/chat/cat-conversation-store';
import { refChip, type CatMessage } from '@/lib/chat/cat-messages';
import { API_ROUTES } from '@/config/api-routes';
import { CAT_AGENT, CAT_HUB_COPY } from '@/config/cat-hub';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import type { CatPageDescriptor } from '@/config/cat-page-context';
import type { CatReference } from '@/config/cat-prompts';
import { transcribeWithRoute } from '@/hooks/useDictation';
import { cn } from '@/lib/utils';
import { useSuggestions, usePendingActionsManager, useMemoryNotes } from './hooks';
import { useCatTransport } from './hooks/useCatTransport';
import { CatAnswerFooter } from './components/CatAnswerFooter';
import { ComposerAttachments } from './components/ComposerAttachments';
import { EmptyState, catStarters } from './components/EmptyState';
import { YourThingsSheet, yourThingsRows } from './components/YourThings';
import { MemoryNoteCard } from './components/MemoryNoteCard';
import { ModelSelector } from './components/ModelSelector';
import { PendingActionsCard } from '../PendingActionsCard';
import { ATTACHMENT_UNSUPPORTED_COPY, CAT_ATTACH_LIMITS } from './attachments';
import type { CatAction } from './types';

/** One transcription route for every microphone in the app; see useDictation. */
const transcribe = transcribeWithRoute(API_ROUTES.CAT.TRANSCRIBE);

/** Which chat was open, so a reload reopens it (device storage: an id, nothing else). */
export const CAT_OPEN_CHAT_KEY = 'oc-cat:open-chat';

/** An in-app route navigates in place; everything else opens beside it. */
const renderAnswerLink: RenderLink = ({ href, internal, className, children }) =>
  internal ? (
    <Link href={href} className={className}>
      {children}
    </Link>
  ) : (
    <a href={href} className={className} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );

interface ModernChatPanelProps {
  /** The query parameter whose words are sent as a new chat's first message
   *  and taken off the address (the hub's `?q=`; never on the launcher). */
  deepLinkParam?: string;
  /** A first-time visitor: the welcome greeting instead of the time of day. */
  isNewUser?: boolean;
  /** The page behind the Cat, when it runs over one (GlobalCatLauncher). */
  pageContext?: CatPageDescriptor | null;
  /** The open chat, when the owner keeps it; `null` = a new chat. */
  conversationId?: string | null;
  onConversationChange?: (id: string | null) => void;
  /** Device key that reopens the open chat after a reload; `null` = never. */
  rememberKey?: string | null;
  /** When the chat list stays beside the chat instead of in a drawer. */
  railQuery?: string;
  /** The page's controls in the header. */
  headerStart?: ReactNode;
  headerEnd?: ReactNode;
  /** One quiet line under the composer. */
  footnote?: ReactNode;
  /** After every turn, answered or not (the page's quota meter). */
  onTurnSettled?: () => void;
  className?: string;
}

export function ModernChatPanel({
  deepLinkParam,
  isNewUser,
  pageContext,
  conversationId,
  onConversationChange,
  rememberKey = CAT_OPEN_CHAT_KEY,
  railQuery,
  headerStart,
  headerEnd,
  footnote,
  onTurnSettled,
  className,
}: ModernChatPanelProps) {
  const router = useRouter();

  // The model picked in the composer, remembered across reloads (incl. custom ids).
  const [model, setModel] = useState('auto');
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cat:model');
      if (saved) {
        setModel(saved);
      }
    } catch {
      // Storage unavailable — the in-memory default stands.
    }
  }, []);
  const pickModel = useCallback((m: string) => {
    setModel(m);
    try {
      localStorage.setItem('cat:model', m);
    } catch {
      // ignore persistence failures
    }
  }, []);

  // The person's own things for the next message, taken by the send.
  const [references, setReferences] = useState<CatReference[]>([]);
  const referencesRef = useRef(references);
  referencesRef.current = references;
  const [thingsOpen, setThingsOpen] = useState(false);
  const takeReferences = useCallback(() => {
    const taken = referencesRef.current;
    if (taken.length) {
      setReferences([]);
    }
    return taken;
  }, []);

  const { memoryNotes, checkAfterSend, undoNote, dismissNote } = useMemoryNotes();
  const { opener, chips, attachable, dismissOpener, isLoadingSuggestions } = useSuggestions();

  // Pending actions the person answered since their turn ended: the chip
  // under that turn settles, and what the handler said (with its one link)
  // stays over the composer until dismissed.
  const [answered, setAnswered] = useState<Record<string, 'completed' | 'declined'>>({});
  const [outcomes, setOutcomes] = useState<{ id: string; text: string; url?: string }[]>([]);
  const { pendingActions, handleConfirmAction, handleRejectAction, refreshPendingActions } =
    usePendingActionsManager({
      onActionConfirmed: (action, outcome) => {
        setAnswered(a => ({ ...a, [action.id]: 'completed' }));
        setOutcomes(o => [
          ...o,
          {
            id: action.id,
            text: outcome.message ?? `Done: ${action.description}`,
            url: outcome.url,
          },
        ]);
      },
      onActionRejected: id => setAnswered(a => ({ ...a, [id]: 'declined' })),
    });

  const settledRef = useRef(onTurnSettled);
  settledRef.current = onTurnSettled;
  const { transport, endTemporary } = useCatTransport({
    model,
    pageContext,
    takeReferences,
    onSettled: () => {
      // New memories land a few seconds after the reply (detached
      // extraction): poll so they surface as an undoable card, never silently.
      checkAfterSend();
      settledRef.current?.();
    },
    onPendingConfirmation: () => void refreshPendingActions(),
  });

  const store = useMemo(() => catConversationStore(), []);

  // Words sent from outside the composer — the Loki sheet
  // (lib/chat/cat-send-event) — go through ChatApp's own send, so they take
  // exactly the path typing does (new chat, queue, Stop).
  const chatRef = useRef<ChatAppHandle>(null);
  useEffect(() => {
    const onSend = (e: Event) => {
      const text = (e as CustomEvent<string>).detail;
      if (typeof text === 'string' && text.trim()) {
        // Its staged things go with it, so they show on it as they would typed.
        void chatRef.current?.send(text, [], { chips: referencesRef.current.map(refChip) });
      }
    };
    window.addEventListener(CAT_SEND_EVENT, onSend);
    return () => window.removeEventListener(CAT_SEND_EVENT, onSend);
  }, []);

  const attachExtras = useMemo(
    () => yourThingsRows({ openThings: () => setThingsOpen(true), go: href => router.push(href) }),
    [router]
  );

  const onAction = useCallback(
    (action: CatAction) => {
      const prefill = (values: Record<string, unknown>) => {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(values)) {
          if (value !== null && value !== undefined && value !== '') {
            params.set(key, String(value));
          }
        }
        return params.toString();
      };
      if (action.type === 'create_entity') {
        const meta = ENTITY_REGISTRY[action.entityType];
        if (meta?.createPath) {
          router.push(`${meta.createPath}?${prefill(action.prefill)}`);
        }
      } else if (action.type === 'update_entity' || action.type === 'publish_entity') {
        // Entities are edited on their create page in edit mode (?edit=<id>).
        const meta = ENTITY_REGISTRY[action.entityType];
        if (meta?.createPath) {
          router.push(`${meta.createPath}?edit=${action.entityId}`);
        }
      } else if (action.type === 'suggest_wallet') {
        router.push(`${ENTITY_REGISTRY.wallet.basePath}?${prefill(action.prefill)}`);
      }
    },
    [router]
  );

  const above =
    pendingActions.length > 0 || outcomes.length > 0 || memoryNotes.length > 0 ? (
      <div className="oc-chat-above">
        {pendingActions.map(action => (
          <PendingActionsCard
            key={action.id}
            action={action}
            onConfirm={handleConfirmAction}
            onReject={handleRejectAction}
          />
        ))}
        {outcomes.map(o => (
          <p key={o.id} className="oc-chat-outcome" role="status">
            <span className="min-w-0 flex-1">
              {o.text}
              {o.url && (
                <>
                  {' '}
                  <Link href={o.url} className="underline underline-offset-2">
                    Open
                  </Link>
                </>
              )}
            </span>
            <button
              type="button"
              className="ck-icon-btn"
              aria-label="Dismiss"
              onClick={() => setOutcomes(list => list.filter(x => x.id !== o.id))}
            >
              ×
            </button>
          </p>
        ))}
        <MemoryNoteCard notes={memoryNotes} onUndo={undoNote} onDismiss={dismissNote} />
      </div>
    ) : undefined;

  return (
    <div className={cn('oc-chat-app', className)}>
      <ChatApp
        ref={chatRef}
        name={CAT_AGENT.name}
        transport={transport}
        store={store}
        fill="parent"
        rememberKey={rememberKey}
        conversationId={conversationId}
        onConversationChange={onConversationChange}
        onTemporaryEnd={endTemporary}
        deepLinkParam={deepLinkParam}
        // The door, the palette and "ask about this" links send what they
        // carry: the person already said it once, where they came from.
        deepLinkAutoSend={!!deepLinkParam}
        chipsFor={() => referencesRef.current.map(refChip)}
        railQuery={railQuery}
        placeholder={CAT_HUB_COPY.composerPlaceholder}
        starters={catStarters(opener, chips)}
        startersTitle={
          <EmptyState
            opener={opener}
            chips={chips}
            isLoadingSuggestions={isLoadingSuggestions}
            onDismissOpener={dismissOpener}
            isNewUser={isNewUser}
          />
        }
        headerStart={headerStart}
        headerEnd={headerEnd}
        footnote={footnote}
        composer={{
          attach: CAT_ATTACH_LIMITS,
          attachExtras,
          attachmentOnlyText: CAT_HUB_COPY.attachmentOnly,
          heldAttachments: references.length,
          voice: { prefer: 'server', transcribe },
          above,
          header:
            references.length > 0 ? (
              <ComposerAttachments
                references={references}
                onRemove={ref => setReferences(list => list.filter(r => r !== ref))}
              />
            ) : undefined,
          tools: <ModelSelector selectedModel={model} onSelect={pickModel} openUp subtle />,
          labels: {
            voice: 'Dictate your message',
            attachNotes: { wrongType: () => ATTACHMENT_UNSUPPORTED_COPY },
          },
        }}
        thread={{
          renderLink: renderAnswerLink,
          share: { title: CAT_AGENT.name },
          labels: { working: CAT_HUB_COPY.thinking },
          onFeedback: ({ conversationId: id, ...feedback }) => {
            if (id) {
              void postChatFeedback(id, feedback);
            }
          },
          renderFooter: (m, { isLatest }) =>
            m.role === 'assistant' ? (
              <CatAnswerFooter
                message={m as CatMessage}
                isLatest={isLatest}
                onAction={onAction}
                answered={answered}
              />
            ) : null,
        }}
      />
      <YourThingsSheet
        open={thingsOpen}
        onClose={() => setThingsOpen(false)}
        attachable={attachable}
        onReference={ref =>
          setReferences(list =>
            list.some(r => r.id === ref.id && r.type === ref.type) ? list : [...list, ref]
          )
        }
      />
    </div>
  );
}

export default ModernChatPanel;
