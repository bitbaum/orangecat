// @vitest-environment jsdom
/**
 * A direct message is typed into chatkit's Composer, the same box as the
 * Cat's, so it has a microphone (owner, 2026-11-04: "there's no way to send a
 * voice message"). Enter sends; while the @mention menu is open Enter picks a
 * person instead and must not send.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

const handleSubmit = vi.fn(async () => {});
const mention = { open: false };
const mentionKey = vi.fn((e: React.KeyboardEvent) => {
  if (mention.open && e.key === 'Enter') {
    e.preventDefault();
    return true;
  }
  return false;
});

vi.mock('@/components/messaging/useMessageComposer', () => ({
  useMessageComposer: () => {
    const [content, setContent] = React.useState('');
    return {
      content,
      isSending: false,
      textareaRef: React.useRef<HTMLTextAreaElement>(null),
      selectedActor: null,
      selectedActorId: null,
      setSelectedActorId: () => {},
      showActorSelector: false,
      personalActor: null,
      groupActors: [],
      typingText: '',
      handleSubmit,
      handleTextChange: setContent,
    };
  },
}));
vi.mock('@/hooks/useMentionAutocomplete', () => ({
  useMentionAutocomplete: () => ({
    items: [],
    activeIndex: 0,
    open: mention.open,
    refresh: () => {},
    close: () => {},
    pick: () => {},
    setActiveIndex: () => {},
    handleKeyDown: mentionKey,
  }),
}));

import MessageComposer from '@/components/messaging/MessageComposer';

// jsdom has no recorder; a browser does, and then chatkit draws the mic.
class FakeRecorder {
  static isTypeSupported() {
    return true;
  }
}
Object.assign(globalThis, { MediaRecorder: FakeRecorder });
Object.defineProperty(globalThis.navigator, 'mediaDevices', {
  configurable: true,
  value: { getUserMedia: async () => ({}) },
});

describe('MessageComposer on chatkit', () => {
  beforeEach(() => {
    handleSubmit.mockClear();
    mention.open = false;
  });

  it('has a message box, a microphone, Ask Cat and Send', () => {
    render(<MessageComposer conversationId="c1" onMessageSent={() => {}} />);
    expect(screen.getByRole('combobox', { name: 'Message' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Speak your message/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Ask Cat in this conversation/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Send message/i })).toBeTruthy();
  });

  it('Enter sends what was typed', async () => {
    render(<MessageComposer conversationId="c1" onMessageSent={() => {}} />);
    const box = screen.getByRole('combobox', { name: 'Message' });
    fireEvent.change(box, { target: { value: 'hello' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await new Promise(r => setTimeout(r, 0));
    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  it('Enter picks a mention instead of sending while the menu is open', async () => {
    mention.open = true;
    render(<MessageComposer conversationId="c1" onMessageSent={() => {}} />);
    const box = screen.getByRole('combobox', { name: 'Message' });
    fireEvent.change(box, { target: { value: '@ca' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await new Promise(r => setTimeout(r, 0));
    expect(mentionKey).toHaveBeenCalled();
    expect(handleSubmit).not.toHaveBeenCalled();
  });
});
