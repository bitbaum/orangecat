// @vitest-environment jsdom
/**
 * The Cat chat composer's textarea grows to fit typed content, resized
 * imperatively from the DOM `onChange` handler. That only fires on user
 * keystrokes — so a *programmatic* value change left the box stuck at
 * whatever height it last had: still expanded after a message sent (value
 * cleared with no keystroke), and never grown when a dictated transcript
 * was inserted (dictation sets the value directly). Visitors reported both as
 * the composer "sticking" and the mic button "doing nothing". The box is now
 * chatkit's Composer, which grows on the value itself; this pins that here.
 *
 * jsdom performs no layout, so `scrollHeight` never reflects real content —
 * each case stubs it to the value a real browser would report, then checks
 * the composer's inline height tracks it.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { ChatInput } from '@/components/ai-chat/ModernChatPanel/components/ChatInput';

function setup() {
  let value = '';
  const onChange = (v: string) => {
    value = v;
    rerenderWith(v);
  };
  const utils = render(
    <ChatInput value={value} onChange={onChange} onSend={() => {}} isLoading={false} />
  );
  function rerenderWith(v: string) {
    utils.rerender(<ChatInput value={v} onChange={onChange} onSend={() => {}} isLoading={false} />);
  }
  return { ...utils, rerenderWith };
}

describe('Cat chat composer resize', () => {
  it('resets height when the composer is cleared programmatically (post-send)', () => {
    const { rerenderWith } = setup();
    const textarea = screen.getByPlaceholderText(/./i) as HTMLTextAreaElement;

    Object.defineProperty(textarea, 'scrollHeight', { configurable: true, value: 150 });
    fireEvent.change(textarea, { target: { value: 'line1\nline2\nline3\nline4' } });
    expect(textarea.style.height).toBe('150px');

    // handleSend clears the controlled value with no DOM change event.
    Object.defineProperty(textarea, 'scrollHeight', { configurable: true, value: 36 });
    rerenderWith('');

    expect(textarea.value).toBe('');
    expect(textarea.style.height).toBe('36px');
  });

  it('grows when text arrives without a keystroke (a dictated transcript)', () => {
    const { rerenderWith } = setup();
    const textarea = screen.getByPlaceholderText(/./i) as HTMLTextAreaElement;

    // Dictation fills the draft directly, not through a DOM change event.
    Object.defineProperty(textarea, 'scrollHeight', { configurable: true, value: 96 });
    rerenderWith('a dictated sentence that is reasonably long');

    expect(textarea.value).toContain('a dictated sentence');
    expect(textarea.style.height).toBe('96px');
  });
});
