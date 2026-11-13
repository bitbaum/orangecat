// @vitest-environment jsdom
/**
 * The door has a microphone for everyone. The public map's door used to be a
 * hand-rolled input with none; now it is the same composer as the signed-in
 * one, and a visitor without a session gets the browser's recogniser, because
 * the server transcriber answers 401 without one.
 */
import { render } from '@testing-library/react';
import { TheDoor } from '@/components/map/TheDoor';
import { CHAT_VOICE, SIGNED_OUT_VOICE } from '@/hooks/useDictation';

const { voices, auth } = vi.hoisted(() => ({
  voices: [] as unknown[],
  auth: { user: null as { id: string } | null },
}));
vi.mock('@/stores/auth', () => ({
  useAuthStore: (select: (state: typeof auth) => unknown) => select(auth),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/components/ai-chat/ModernChatPanel/components/ChatInput', () => ({
  ChatInput: ({ voice }: { voice: unknown }) => {
    voices.push(voice);
    return null;
  },
}));

describe('the door’s microphone', () => {
  beforeEach(() => {
    voices.length = 0;
  });

  it('listens in the browser for a visitor with no account', () => {
    auth.user = null;
    render(<TheDoor />);
    expect(voices.at(-1)).toBe(SIGNED_OUT_VOICE);
  });

  it('uses the Cat’s transcriber once signed in', () => {
    auth.user = { id: 'u1' };
    render(<TheDoor />);
    expect(voices.at(-1)).toBe(CHAT_VOICE);
  });
});
