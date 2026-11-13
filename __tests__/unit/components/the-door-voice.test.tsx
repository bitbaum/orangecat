// @vitest-environment jsdom
/**
 * The door has one microphone, the same for everyone. A visitor without a
 * session used to get the browser's recogniser (dead in Brave, absent in
 * Firefox) because the server transcriber answered 401; it now takes a
 * visitor's take on a per-IP budget, so the door no longer asks who you are.
 */
import { render } from '@testing-library/react';
import { TheDoor } from '@/components/map/TheDoor';
import { CHAT_VOICE } from '@/hooks/useDictation';

const { voices } = vi.hoisted(() => ({ voices: [] as unknown[] }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/components/ai-chat/ModernChatPanel/components/ChatInput', () => ({
  ChatInput: ({ voice }: { voice: unknown }) => {
    voices.push(voice);
    return null;
  },
}));

describe('the door’s microphone', () => {
  it('uses the server transcriber, signed in or not', () => {
    render(<TheDoor />);
    expect(voices.at(-1)).toBe(CHAT_VOICE);
  });
});
