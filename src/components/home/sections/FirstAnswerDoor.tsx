'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { ChatInput } from '@/components/ai-chat/ModernChatPanel/components/ChatInput';
import { DoorExamples } from '@/components/dashboard/DoorExamples';
import { BrandMarkIcon } from '@/components/shell/BrandMarkIcon';
import Button from '@/components/ui/Button';
import { API_ROUTES } from '@/config/api-routes';
import { CAT_DOOR, registerHrefKeepingSentence } from '@/config/cat-door';
import { HOME_FIRST_ANSWER_COPY as COPY } from '@/config/landing-page';
import { CHAT_VOICE } from '@/hooks/useDictation';

type Exchange = {
  sentence: string;
  /** The Cat's reply; null when none could be given. */
  answer: string | null;
  /** Shown in place of an answer: why there is none. */
  note: string | null;
};

/** Why a sentence cannot be sent yet, or null. The same bounds every Cat door has. */
export function firstSentenceProblem(sentence: string): string | null {
  if (sentence.length > CAT_DOOR.maxLength) {
    return `Use ${CAT_DOOR.maxLength} characters or fewer to start a conversation.`;
  }
  return sentence.length < CAT_DOOR.minLength
    ? `Enter at least ${CAT_DOOR.minLength} characters.`
    : null;
}

/**
 * One sentence in, one real answer out, then the way to keep going.
 *
 * The composer and the example row are the ones every Cat door has (ChatInput,
 * DoorExamples), microphone included. What differs is where the sentence
 * goes: to /api/cat/first-answer, which answers a visitor on a per-IP budget.
 * After the answer the box gives way to the invitation, whose link carries
 * the same sentence through sign-up to the visitor's own Cat. If no answer
 * can be given (the budget is spent, or no model answered) the sentence is
 * still kept and the invitation says so; the visitor never loses what they
 * typed.
 */
export function FirstAnswerDoor({ examples }: { examples?: readonly string[] }) {
  const [value, setValue] = useState('');
  const [asking, setAsking] = useState(false);
  const [exchange, setExchange] = useState<Exchange | null>(null);
  const text = value.trim();
  const blockedReason = firstSentenceProblem(text);

  async function ask(sentence: string) {
    if (asking) {
      return;
    }
    setAsking(true);
    let answer: string | null = null;
    let note: string | null = COPY.noAnswer;
    try {
      const response = await fetch(API_ROUTES.CAT.FIRST_ANSWER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentence }),
      });
      if (response.status === 429) {
        note = COPY.limitReached;
      } else if (response.ok) {
        const json = await response.json().catch(() => null);
        if (typeof json?.data?.answer === 'string' && json.data.answer.trim()) {
          answer = json.data.answer.trim();
          note = null;
        }
      }
    } catch {
      // No connection: the note already says the sentence is kept.
    }
    setExchange({ sentence, answer, note });
    setAsking(false);
  }

  if (exchange) {
    return (
      <div className="mt-6 space-y-4" aria-live="polite">
        <p className="mb-0 ml-auto w-fit max-w-[85%] break-words rounded-lg bg-surface-raised px-4 py-3 text-base text-fg-primary">
          <span className="sr-only">{COPY.yourSentence}: </span>
          {exchange.sentence}
        </p>
        <div className="flex items-start gap-3">
          <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-raised text-fg-secondary">
            <BrandMarkIcon className="h-4 w-4" aria-hidden />
          </span>
          <p className="mb-0 min-w-0 whitespace-pre-line break-words rounded-lg border border-default bg-surface-base px-4 py-3 text-base leading-relaxed text-fg-primary">
            {exchange.answer ?? exchange.note}
          </p>
        </div>
        <div className="oc-surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
          <p className="mb-0 flex-1 text-base text-fg-primary">{COPY.inviteLead}</p>
          <Button
            href={registerHrefKeepingSentence(exchange.sentence)}
            variant="accent"
            size="lg"
            className="w-full sm:w-auto"
          >
            {COPY.invite}
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-2">
      <ChatInput
        value={value}
        onChange={setValue}
        onSend={() => {
          if (!blockedReason) {
            void ask(text);
          }
          // The words stay in the box until the answer replaces it.
          return false;
        }}
        isLoading={asking}
        placement="inline"
        autoFocus={false}
        placeholder={CAT_DOOR.placeholder}
        ariaLabel={CAT_DOOR.prompt}
        sendLabel={CAT_DOOR.submit}
        sendBlockedReason={blockedReason}
        voice={CHAT_VOICE}
      />
      {asking ? (
        <p role="status" className="mb-0 text-sm text-fg-secondary">
          {COPY.asking}
        </p>
      ) : (
        <DoorExamples
          examples={examples}
          onPick={example => {
            setValue(example);
            void ask(example);
          }}
        />
      )}
    </div>
  );
}
