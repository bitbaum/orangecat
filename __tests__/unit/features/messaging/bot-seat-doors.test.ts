/**
 * Who may write to a bot in Messages, and what they are told it costs
 * (ADR-0015, build order 1 and 5). The tables are faked; the rules are real.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => {
  const tables: Record<string, unknown[]> = {};
  const fromTable = (_admin: unknown, table: string) => {
    const chain: Record<string, unknown> = {};
    for (const op of ['select', 'eq', 'in', 'is', 'update', 'insert']) {
      chain[op] = () => chain;
    }
    chain.maybeSingle = async () => ({ data: (tables[table] ?? [])[0] ?? null, error: null });
    chain.then = (resolve: (value: unknown) => unknown) =>
      resolve({ data: tables[table] ?? [], error: null });
    return chain;
  };
  return { tables, fromTable };
});
vi.mock('@/lib/supabase/untyped', () => ({ fromTable: db.fromTable }));

import {
  closedSeatAmong,
  seatCompanionsFor,
  seatPricesFor,
} from '@/features/messaging/server/bot-seats';
import { pricedBots, sameBots } from '@/features/messaging/lib/priced-bots';
import type { Conversation } from '@/features/messaging/types';

const admin = {} as never;
const companion = (extra: Record<string, unknown> = {}) => ({
  id: 'a1',
  user_id: 'owner',
  title: 'Chef',
  avatar_url: null,
  status: 'active',
  is_public: true,
  pricing_model: 'free',
  price_per_message: null,
  ...extra,
});

beforeEach(() => {
  for (const key of Object.keys(db.tables)) {
    delete db.tables[key];
  }
  // The companion already has a seat, so nothing is created here.
  db.tables.companion_seats = [{ assistant_id: 'a1', user_id: 'seat-1' }];
});

describe('starting a conversation with a bot', () => {
  it('its owner always may', async () => {
    db.tables.ai_assistants = [companion({ is_public: false, status: 'draft' })];
    expect(await seatCompanionsFor(admin, 'owner', ['a1'])).toEqual([
      { assistantId: 'a1', userId: 'seat-1' },
    ]);
  });

  it('anybody may while it is public and active', async () => {
    db.tables.ai_assistants = [companion()];
    expect(await seatCompanionsFor(admin, 'stranger', ['a1'])).toEqual([
      { assistantId: 'a1', userId: 'seat-1' },
    ]);
  });

  it('nobody else may write to a private bot, or to one that is switched off', async () => {
    db.tables.ai_assistants = [companion({ is_public: false })];
    expect(await seatCompanionsFor(admin, 'stranger', ['a1'])).toBeNull();
    db.tables.ai_assistants = [companion({ status: 'paused' })];
    expect(await seatCompanionsFor(admin, 'stranger', ['a1'])).toBeNull();
  });

  it('a bot that does not exist opens nothing', async () => {
    db.tables.ai_assistants = [];
    expect(await seatCompanionsFor(admin, 'owner', ['missing'])).toBeNull();
  });
});

describe('a seat named by its account id', () => {
  it('follows the same door: private is closed to a stranger, public is open', async () => {
    db.tables.ai_assistants = [companion({ is_public: false })];
    expect(await closedSeatAmong(admin, 'stranger', ['seat-1'])).toBe(true);
    expect(await closedSeatAmong(admin, 'owner', ['seat-1'])).toBe(false);
    db.tables.ai_assistants = [companion()];
    expect(await closedSeatAmong(admin, 'stranger', ['seat-1'])).toBe(false);
  });

  it('a seat whose bot was deleted is closed to everybody', async () => {
    db.tables.companion_seats = [{ assistant_id: null, user_id: 'seat-1' }];
    expect(await closedSeatAmong(admin, 'owner', ['seat-1'])).toBe(true);
  });

  it('people are not seats: nothing is closed', async () => {
    db.tables.companion_seats = [];
    expect(await closedSeatAmong(admin, 'me', ['maya'])).toBe(false);
  });
});

describe('what a bot charges, said before the first message', () => {
  const seats = new Map<string, string | null>([['seat-1', 'a1']]);

  it('a stranger is told the price per message', async () => {
    db.tables.ai_assistants = [
      companion({ pricing_model: 'per_message', price_per_message: 0.000001 }),
    ];
    expect([...(await seatPricesFor(admin, 'stranger', seats))]).toEqual([['seat-1', 0.000001]]);
  });

  it('a free bot, and the viewer’s own bot, have no price to show', async () => {
    db.tables.ai_assistants = [companion()];
    expect((await seatPricesFor(admin, 'stranger', seats)).size).toBe(0);
    db.tables.ai_assistants = [
      companion({ pricing_model: 'per_message', price_per_message: 0.000001 }),
    ];
    expect((await seatPricesFor(admin, 'owner', seats)).size).toBe(0);
  });

  it('reaches the screen as the bots of the conversation that charge', () => {
    const seat = (user_id: string, extra: Record<string, unknown> = {}) => ({
      user_id,
      username: user_id,
      name: user_id,
      avatar_url: null,
      role: 'member',
      joined_at: '',
      last_read_at: '',
      is_active: true,
      ...extra,
    });
    const conversation = {
      id: 'c',
      participants: [
        seat('me'),
        seat('free', { is_agent: true }),
        seat('paid', { is_agent: true, name: 'Chef', agent_price_btc: 0.000001 }),
      ],
    } as unknown as Conversation;
    const bots = pricedBots(conversation);
    expect(bots).toEqual([{ id: 'paid', name: 'Chef', priceBtc: 0.000001 }]);
    expect(sameBots(bots, bots)).toBe(true);
    expect(sameBots(undefined, [])).toBe(true);
    expect(sameBots(bots, [])).toBe(false);
  });
});
