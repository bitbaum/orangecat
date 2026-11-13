/**
 * A bot's seat in Messages (ADR-0015): what the bot is told, what it reads,
 * and that its account is not a person to find.
 */
import { isFixtureUsername, SEAT_USERNAME } from '@/config/public-directory';
import { messagesScene, transcriptForSeat } from '@/features/messaging/server/bot-answer';

vi.mock('@/lib/supabase/untyped', () => ({ fromTable: vi.fn() }));
vi.mock('@/services/companions/answer', () => ({ companionAnswer: vi.fn() }));
vi.mock('@/features/messaging/server/write-message', () => ({ writeMessage: vi.fn() }));

describe('what a bot reads of a conversation', () => {
  it('its own lines are the assistant’s, everyone else’s the user’s, oldest first', () => {
    expect(
      transcriptForSeat(
        [
          { sender_id: 'me', content: 'Hello' },
          { sender_id: 'seat', content: 'Hi. What do you need?' },
          { sender_id: 'me', content: '  A budget  ' },
        ],
        'seat'
      )
    ).toEqual([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi. What do you need?' },
      { role: 'user', content: 'A budget' },
    ]);
  });

  it('a message of only files is not handed over as an empty line', () => {
    expect(
      transcriptForSeat(
        [
          { sender_id: 'me', content: '' },
          { sender_id: 'me', content: null },
        ],
        'seat'
      )
    ).toEqual([]);
  });
});

describe('what a bot is told about where it is', () => {
  it('keeps its own definition first and adds the scene', () => {
    const scene = messagesScene('You are a careful accountant.');
    expect(scene.startsWith('You are a careful accountant.')).toBe(true);
    expect(scene).toContain('OrangeCat Messages');
  });

  it('still has a scene when the bot has no definition', () => {
    expect(messagesScene(undefined)).toContain('OrangeCat Messages');
  });
});

describe('a seat is an account, not a person to find', () => {
  it('its handle is kept out of people search, Discover and the sitemap', () => {
    expect(SEAT_USERNAME.test('seat_0123456789ab')).toBe(true);
    expect(isFixtureUsername('seat_0123456789ab')).toBe(true);
  });

  it('a person whose handle merely starts with "seat" is still found', () => {
    expect(isFixtureUsername('seat_of_power')).toBe(false);
    expect(isFixtureUsername('seatmaker')).toBe(false);
  });
});
