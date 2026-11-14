import { describe, expect, it } from 'vitest';
import {
  SUGGESTED_PEOPLE_MAX,
  newMessageSuggestions,
  recentPeople,
} from '@/features/messaging/lib/new-suggestions';
import type { Conversation, Participant } from '@/features/messaging/types';

const seat = (user_id: string, extra: Partial<Participant> = {}): Participant => ({
  user_id,
  username: user_id,
  name: user_id.toUpperCase(),
  avatar_url: null,
  role: 'member',
  joined_at: '2026-11-01T00:00:00Z',
  last_read_at: '',
  is_active: true,
  ...extra,
});
const talk = (id: string, at: string, others: Participant[], is_group = false): Conversation => ({
  id,
  title: null,
  is_group,
  last_message_at: at,
  last_message_preview: 'hi',
  participants: [seat('me'), ...others],
  unread_count: 0,
});

describe('who the viewer wrote with last', () => {
  it('is the other person of each one-to-one, newest first', () => {
    const people = recentPeople(
      [
        talk('a', '2026-11-10T10:00:00Z', [seat('ada')]),
        talk('b', '2026-11-12T10:00:00Z', [seat('ben')]),
      ],
      'me'
    );
    expect(people.map(p => p.id)).toEqual(['ben', 'ada']);
  });

  it('leaves out groups, agents, notes to self and people who are gone', () => {
    const people = recentPeople(
      [
        talk('g', '2026-11-12T10:00:00Z', [seat('ada'), seat('ben')], true),
        talk('c', '2026-11-12T09:00:00Z', [seat('cat', { is_agent: true })]),
        talk('s', '2026-11-12T08:00:00Z', []),
        talk('x', '2026-11-12T07:00:00Z', [seat('zoe', { is_active: false })]),
        talk('ok', '2026-11-01T07:00:00Z', [seat('maya')]),
      ],
      'me'
    );
    expect(people.map(p => p.id)).toEqual(['maya']);
  });
});

describe('what New opens on', () => {
  const cat = { id: 'cat-id', name: 'Cat', handle: 'cat', kind: 'agent' as const };
  const bot = { id: 'bot:b1', name: 'Chef', kind: 'agent' as const };

  it('the Cat, the viewer’s bots, recent people, then followed people: nobody twice', () => {
    const offered = newMessageSuggestions({
      viewerId: 'me',
      agents: [cat, bot],
      recent: [{ id: 'ben', username: 'ben', name: 'Ben Ito' }],
      followed: [
        { id: 'ben', username: 'ben', name: 'Ben Ito' },
        { id: 'ada', username: 'ada', name: 'Ada Okafor', avatar_url: '/a.png' },
        { id: 'me', username: 'me', name: 'Me' },
      ],
    });
    expect(offered.map(p => p.id)).toEqual(['cat-id', 'bot:b1', 'ben', 'ada']);
    expect(offered[0]).toMatchObject({ kind: 'agent', name: 'Cat' });
    expect(offered[3]).toEqual({
      id: 'ada',
      name: 'Ada Okafor',
      handle: 'ada',
      avatarUrl: '/a.png',
    });
  });

  it('never offers an unnamed placeholder account, and stops at a list a person can read', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      id: `p${i}`,
      username: `person${i}`,
      name: `Person ${i}`,
    }));
    const offered = newMessageSuggestions({
      viewerId: 'me',
      agents: [],
      recent: [{ id: 'ghost', username: 'user_4a12bc9f', name: null }, ...many],
      followed: [],
    });
    expect(offered.some(p => p.id === 'ghost')).toBe(false);
    expect(offered).toHaveLength(SUGGESTED_PEOPLE_MAX);
  });

  it('with nothing known offers nothing, so the sheet keeps its hint', () => {
    expect(newMessageSuggestions({ viewerId: 'me', agents: [], recent: [], followed: [] })).toEqual(
      []
    );
  });
});
