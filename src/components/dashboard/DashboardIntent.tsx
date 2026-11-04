'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChatInput } from '@/components/ai-chat/ModernChatPanel/components/ChatInput';
import { CAT_DOOR, CAT_QUERY_PARAM } from '@/config/cat-door';
import { ROUTES } from '@/config/routes';

/**
 * The one "What do you want to do?" entry for signed-in pages (dashboard, My
 * things, empty states). Built on chatkit's Composer via ChatInput, so it has
 * Cat's keyboard, dictation and draft behaviour everywhere — no bespoke boxes.
 */
export function DashboardIntent({ examples }: { examples?: readonly string[] } = {}) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const text = value.trim();
  const tooLong = text.length > CAT_DOOR.maxLength;
  const blockedReason = tooLong
    ? `Use ${CAT_DOOR.maxLength} characters or fewer to start a conversation.`
    : text.length < CAT_DOOR.minLength
      ? `Enter at least ${CAT_DOOR.minLength} characters.`
      : null;

  return (
    <section aria-labelledby="dashboard-intent-heading" className="space-y-2">
      <h2 id="dashboard-intent-heading" className="font-heading text-lg text-fg-primary">
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
      />
      {examples && examples.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Examples">
          {examples.map(example => (
            <li key={example}>
              <a
                href={`${ROUTES.DASHBOARD.CAT}?${CAT_QUERY_PARAM}=${encodeURIComponent(example)}`}
                className="inline-block rounded-full border border-default px-3 py-1.5 text-xs text-fg-secondary hover:border-interactive hover:text-fg-primary"
              >
                {example}
              </a>
            </li>
          ))}
        </ul>
      )}
      {tooLong && (
        <p role="alert" className="text-sm text-status-negative">
          {blockedReason}
        </p>
      )}
    </section>
  );
}
