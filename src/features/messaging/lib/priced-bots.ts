/**
 * The bots in a conversation that charge the viewer per message.
 *
 * The server says the price on the bot's seat (only for a bot that is not
 * the viewer's own, and only when it charges). The screen shows it above the
 * message box, so nobody learns what a bot costs by being charged.
 */

import type { Conversation } from '../types';

export interface PricedBot {
  id: string;
  name: string;
  priceBtc: number;
}

export function pricedBots(conversation: Conversation): PricedBot[] {
  return (conversation.participants ?? [])
    .filter(p => p.is_agent && p.is_active !== false && (p.agent_price_btc ?? 0) > 0)
    .map(p => ({ id: p.user_id, name: p.name || 'This bot', priceBtc: p.agent_price_btc! }));
}

/** The same bots at the same prices: nothing to redraw. */
export function sameBots(a: readonly PricedBot[] | undefined, b: readonly PricedBot[]): boolean {
  return (
    (a?.length ?? 0) === b.length &&
    b.every((bot, i) => a?.[i]?.id === bot.id && a[i]?.priceBtc === bot.priceBtc)
  );
}
