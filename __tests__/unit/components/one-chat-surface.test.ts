import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * One conversation surface for the whole app.
 *
 * This repo grew THREE composers and THREE message renderers: Cat's pair, an
 * older pair left over from the assistant widget, and a third pair written for
 * the companion room by someone (me) who did not check that Cat's already put
 * every Cat-specific control behind an optional prop. Two pairs were deleted.
 *
 * A fourth is cheap to add and invisible in review, so the rule is a test: if
 * a file renders its own chat textarea or its own message-turn layout, it has
 * to be the shared one. Reuse ChatInput / MessageBubble and pass only what you
 * need — that is what their `variant` and optional props are for.
 */

const SHARED_COMPOSER = 'src/components/ai-chat/ModernChatPanel/components/ChatInput.tsx';
const SHARED_BUBBLE = 'src/components/ai-chat/ModernChatPanel/components/MessageBubble.tsx';

/**
 * Enter-to-send textareas that are deliberately NOT the chat composer. Each
 * needs a reason, because "it is a bit different" is how the third chat UI got
 * written. Adding a row is a decision someone makes on purpose, in review.
 */
const NOT_A_CONVERSATION: Record<string, string> = {
  'src/components/create/AIFillPanel.tsx':
    'one-shot prompt that fills a form — no turns, no history, no reply',
  'src/components/messaging/MessageView/MessageItem.tsx':
    'human-to-human DM with delivery and read receipts, on threadkit — a different job from an AI turn',
  'src/components/timeline/RepostModal.tsx': 'post composer, not a conversation',
  'src/components/timeline/ShareModal.tsx': 'post composer, not a conversation',
};

function filesUnder(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      filesUnder(path, out);
    } else if (/\.tsx$/.test(name)) {
      out.push(path);
    }
  }
  return out;
}

const components = filesUnder('src/components');

describe('one chat surface', () => {
  it('has exactly one composer: a chat textarea lives in ChatInput only', () => {
    const offenders = components.filter(path => {
      if (path === SHARED_COMPOSER || path in NOT_A_CONVERSATION) {
        return false;
      }
      const src = readFileSync(path, 'utf8');
      // A <textarea> whose keydown handler sends on Enter is a composer,
      // whatever it is called. Plain form textareas have no such handler.
      return /<textarea/.test(src) && /key\s*===\s*'Enter'|key:\s*'Enter'/.test(src);
    });
    expect(
      offenders,
      `These send on Enter without being the shared composer. Reuse ChatInput, or ` +
        `add the file to NOT_A_CONVERSATION with the reason it is not one:\n${offenders.join('\n')}`
    ).toEqual([]);
  });

  it('keeps the exception list honest — every entry still exists and still sends on Enter', () => {
    for (const [path, reason] of Object.entries(NOT_A_CONVERSATION)) {
      expect(reason.length, `${path} needs a real reason`).toBeGreaterThan(20);
      const src = readFileSync(path, 'utf8');
      expect(
        /<textarea/.test(src),
        `${path} no longer has a textarea — drop it from the exception list`
      ).toBe(true);
    }
  });

  it('has exactly one message renderer: no second turn layout', () => {
    const offenders = components.filter(path => {
      if (path === SHARED_BUBBLE) {
        return false;
      }
      const src = readFileSync(path, 'utf8');
      // Branching a turn's layout on who spoke is what a message renderer does.
      return /role\s*===\s*'user'/.test(src) && /className=/.test(src);
    });
    expect(offenders, `These re-implement the message turn:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('keeps the shared pair reusable — Cat-only controls stay optional', () => {
    const composer = readFileSync(SHARED_COMPOSER, 'utf8');
    for (const prop of ['onStop', 'onClearChat', 'selectedModel', 'onModelSelect', 'placeholder']) {
      expect(composer, `${prop} must stay optional or the composer stops being shareable`).toMatch(
        new RegExp(`${prop}\\?:`)
      );
    }
    const bubble = readFileSync(SHARED_BUBBLE, 'utf8');
    for (const prop of ['onActionClick', 'onQuickReply']) {
      expect(bubble).toMatch(new RegExp(`${prop}\\?:`));
    }
  });
});
