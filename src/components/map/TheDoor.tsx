'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChatInput } from '@/components/ai-chat/ModernChatPanel/components/ChatInput';
import { DoorExamples } from '@/components/dashboard/DoorExamples';
import { CAT_DOOR, CAT_QUERY_PARAM } from '@/config/cat-door';
import { ROUTES } from '@/config/routes';
import { CHAT_VOICE, SIGNED_OUT_VOICE } from '@/hooks/useDictation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';

interface TheDoorProps {
  /** A short row of example sentences the visitor can tap. */
  examples?: readonly string[];
  className?: string;
}

/**
 * The door — "What do you want to do?", one sentence in, the Cat out.
 *
 * The one entry of its kind, signed in or not: the dashboard, My things and
 * the public map all render this. The public map used to hand-roll a text
 * input with no microphone while the signed-in one had chatkit's Composer
 * (via ChatInput): two components for one thing, and the one a newcomer met
 * could not be spoken to.
 *
 * Sending pushes `/dashboard/cat?q=…`. A signed-out visitor is carried
 * through sign-up by the middleware and arrives at the Cat with the sentence
 * intact. Their microphone is the browser's (SIGNED_OUT_VOICE): the server
 * transcriber needs a session.
 */
export function TheDoor({ examples, className }: TheDoorProps = {}) {
  const router = useRouter();
  const headingId = useId();
  const signedIn = useAuthStore(state => !!state.user);
  const [value, setValue] = useState('');
  const text = value.trim();
  const tooLong = text.length > CAT_DOOR.maxLength;
  const blockedReason = tooLong
    ? `Use ${CAT_DOOR.maxLength} characters or fewer to start a conversation.`
    : text.length < CAT_DOOR.minLength
      ? `Enter at least ${CAT_DOOR.minLength} characters.`
      : null;

  return (
    <section aria-labelledby={headingId} className={cn('space-y-2', className)}>
      <h2 id={headingId} className="font-heading text-lg text-fg-primary">
        {CAT_DOOR.prompt}
      </h2>
      <ChatInput
        value={value}
        onChange={setValue}
        onSend={() => {
          if (!blockedReason) {
            router.push(`${ROUTES.DASHBOARD.CAT}?${CAT_QUERY_PARAM}=${encodeURIComponent(text)}`);
          }
          // Keep the words until navigation succeeds and this entry unmounts.
          return false;
        }}
        isLoading={false}
        placement="inline"
        autoFocus={false}
        placeholder={CAT_DOOR.placeholder}
        ariaLabel={CAT_DOOR.prompt}
        sendLabel={CAT_DOOR.submit}
        sendBlockedReason={blockedReason}
        voice={signedIn ? CHAT_VOICE : SIGNED_OUT_VOICE}
      />
      <DoorExamples examples={examples} />
      {tooLong && (
        <p role="alert" className="text-sm text-status-negative">
          {blockedReason}
        </p>
      )}
    </section>
  );
}

export default TheDoor;
