'use client';

/**
 * Messages: the packaged Messenger (`@bitbaum/chatkit/messenger`), on
 * OrangeCat's backend.
 *
 * The screen and everything it does — the list, the thread, the box, files,
 * who is an agent and who is a person — is the package's, so it is the same
 * messenger every bitbaum product gets. What is OrangeCat's is here: the
 * transport (features/messaging/messenger-transport.ts), the Cat as the agent
 * people can bring in, writing as a group you administer, the @mention menu,
 * and the frame it sits in.
 *
 * On a phone an open conversation owns the screen (IMMERSIVE_CHAT_ATTR): no
 * app header above it and no tab bar under it, so the box sits at the bottom
 * of the display and the rest is the conversation.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Messenger, type MessengerAgent } from '@bitbaum/chatkit/messenger';
import '@bitbaum/chatkit/styles/messenger.css';
import MentionSuggestions from '@/components/mentions/MentionSuggestions';
import { textareaSurface } from '@/components/mentions/caret';
import { BrandMarkIcon } from '@/components/shell/BrandMarkIcon';
import { CAT_AVATAR_SRC, CAT_DISPLAY_NAME, CAT_MENTION } from '@/config/cat-identity';
import { APP_CONTENT_HEIGHT_CLASS, IMMERSIVE_CHAT_ATTR } from '@/config/layout-chrome';
import {
  MESSAGE_ATTACHMENT_POLICY,
  MESSAGE_IMAGE_MAX_BYTES,
  MESSAGE_IMAGE_MAX_EDGE,
} from '@/config/message-attachments';
import { ROUTES } from '@/config/routes';
import { useMessagingActors } from '@/features/messaging/hooks/useMessagingActors';
import { takeMessageDraft } from '@/features/messaging/lib/draft';
import { createMessengerTransport } from '@/features/messaging/messenger-transport';
import { moneyActions } from '@/features/messaging/money-actions';
import { pricedBots, sameBots, type PricedBot } from '@/features/messaging/lib/priced-bots';
import { CHAT_VOICE } from '@/hooks/useDictation';
import { useMentionAutocomplete } from '@/hooks/useMentionAutocomplete';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { useSoftKeyboard } from '@/hooks/useSoftKeyboard';
import { useUserCurrency } from '@/hooks/useUserCurrency';
import { cn } from '@/lib/utils';
import { announceMessagesRead } from '@/hooks/useUnreadMessagesSync';
import { MessageActorSelector } from './MessageActorSelector';
import { WritingAs } from '@/components/identities/WritingAs';

interface MessagesScreenProps {
  userId: string;
  /** The open conversation, from the URL (so a link and Back work). */
  conversationId: string | null;
  onConversationChange: (id: string | null) => void;
}

export default function MessagesScreen({
  userId,
  conversationId,
  onConversationChange,
}: MessagesScreenProps) {
  const keyboardOpen = useSoftKeyboard();
  const { actors, agent, personalActor, groupActors } = useMessagingActors();

  // Writing as a group you administer. Read by the transport at send time.
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);
  const actorRef = useRef<string | null>(null);
  useEffect(() => {
    actorRef.current = selectedActorId;
  }, [selectedActorId]);
  const selectedActor = selectedActorId
    ? actors.find(a => a.actor_id === selectedActorId)
    : personalActor;

  // What a bot in each conversation charges the viewer, so the price is on
  // the screen before the first message is written (ADR-0015, build order 5).
  const [prices, setPrices] = useState<Record<string, PricedBot[]>>({});
  const { formatAmountBtc } = useDisplayCurrency();
  const openPrices = conversationId ? (prices[conversationId] ?? []) : [];

  const transport = useMemo(
    () =>
      createMessengerTransport({
        userId,
        onConversation: conversation => {
          const priced = pricedBots(conversation);
          setPrices(current =>
            sameBots(current[conversation.id], priced)
              ? current
              : { ...current, [conversation.id]: priced }
          );
        },
        senderActorId: () => actorRef.current,
        // The app shell's useUnreadMessagesSync owns the badge; this nudges it.
        onUnreadMayHaveChanged: announceMessagesRead,
      }),
    [userId]
  );

  // Money in the conversation: OrangeCat's own pay page and payment requests,
  // offered where the person they are for already is.
  const router = useRouter();
  const currency = useUserCurrency();
  const actions = useMemo(
    () =>
      moneyActions({
        viewerId: userId,
        currency,
        navigate: href => router.push(href),
        onError: message => toast.error(message),
      }),
    [userId, currency, router]
  );

  const agents = useMemo<MessengerAgent[]>(
    () =>
      agent
        ? [
            {
              id: agent.id,
              name: agent.name || CAT_DISPLAY_NAME,
              mention: CAT_MENTION,
              // One face for the Cat: list, picker and thread all draw this picture.
              avatarUrl: CAT_AVATAR_SRC,
              hint: 'Everyone in the conversation sees its answer',
            },
          ]
        : [],
    [agent]
  );

  // The @mention menu is a combobox on the box the package draws.
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const mentions = useMentionAutocomplete({ surface: textareaSurface(inputRef) });
  const { open: menuOpen, activeIndex } = mentions;
  useEffect(() => {
    const el = inputRef.current;
    if (!el) {
      return;
    }
    el.setAttribute('role', 'combobox');
    el.setAttribute('aria-autocomplete', 'list');
    el.setAttribute('aria-controls', 'dm-mention-listbox');
    el.setAttribute('aria-expanded', String(menuOpen));
    if (menuOpen) {
      el.setAttribute('aria-activedescendant', `dm-mention-option-${activeIndex}`);
    } else {
      el.removeAttribute('aria-activedescendant');
    }
  }, [menuOpen, activeIndex, conversationId]);

  const wrap = useCallback(
    (box: ReactNode) => (
      <div
        className="relative"
        // The menu sees a key first: Enter means "pick this person" while it
        // is open and "send" the rest of the time.
        onKeyDownCapture={event => {
          if (mentions.handleKeyDown(event)) {
            event.stopPropagation();
          }
        }}
        onInputCapture={mentions.refresh}
        onClickCapture={mentions.refresh}
        onBlurCapture={mentions.close}
      >
        <MentionSuggestions
          items={mentions.items}
          activeIndex={mentions.activeIndex}
          onPick={mentions.pick}
          onHover={mentions.setActiveIndex}
          placement="above"
          idPrefix="dm-mention"
        />
        {box}
      </div>
    ),
    [mentions]
  );

  return (
    <div
      className={cn(
        APP_CONTENT_HEIGHT_CLASS,
        'oc-messages oc-interface',
        // The list shares the screen with the tab bar; an open conversation
        // on a phone does not (globals.css, "A chat that owns the phone").
        !keyboardOpen && !conversationId && 'app-chat-nav-clearance'
      )}
    >
      <div
        className="h-full min-h-0"
        // The feedback launcher never sits on a conversation.
        data-fc-avoid=""
        // An open conversation owns the phone (the marker is read by rules
        // on its ancestors, so it sits inside the sized frame).
        {...(conversationId ? { [IMMERSIVE_CHAT_ATTR]: '' } : {})}
      >
        <Messenger
          viewer={{ id: userId }}
          transport={transport}
          agents={agents}
          actions={actions}
          listHeader={<WritingAs />}
          agentMark={<BrandMarkIcon size={16} />}
          conversationId={conversationId}
          onConversationChange={onConversationChange}
          profileHref={person => (person.handle ? ROUTES.PROFILES.VIEW(person.handle) : undefined)}
          composer={{
            voice: CHAT_VOICE,
            attach: {
              policy: MESSAGE_ATTACHMENT_POLICY,
              imageMaxEdge: MESSAGE_IMAGE_MAX_EDGE,
              imageMaxBytes: MESSAGE_IMAGE_MAX_BYTES,
            },
            inputRef,
            wrap,
            // A message typed FOR the person by a link ("Ask about this").
            initialDraft: id => takeMessageDraft(id) ?? undefined,
            header:
              openPrices.length > 0 || (actors.length > 1 && selectedActor) ? (
                <>
                  {openPrices.map(bot => (
                    <p key={bot.id} className="mb-0 px-3 pt-1 text-sm text-fg-secondary">
                      {bot.name} charges {formatAmountBtc(bot.priceBtc)} per message, from your Cat
                      Credits.
                    </p>
                  ))}
                  {actors.length > 1 && selectedActor && (
                    <MessageActorSelector
                      selectedActor={selectedActor}
                      selectedActorId={selectedActorId}
                      personalActor={personalActor}
                      groupActors={groupActors}
                      onSelectActor={setSelectedActorId}
                    />
                  )}
                </>
              ) : undefined,
            labels: { voice: 'Speak your message' },
          }}
        />
      </div>
    </div>
  );
}
