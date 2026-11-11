import { describe, expect, it } from 'vitest';
import { FLEET_BOTS } from '@/config/fleet-bots';

/** Every fleet bot opens with a line that says what to send, and three questions to tap. */
describe('fleet bot openings', () => {
  it.each(Object.entries(FLEET_BOTS))(
    '%s says what to send and offers three questions',
    (_, bot) => {
      expect(bot.opening.line.length).toBeGreaterThan(40);
      expect(bot.opening.line).toMatch(/\b(send|paste|photograph)\b/i);
      expect(bot.opening.starters).toHaveLength(3);
      for (const s of bot.opening.starters) {
        expect(s.trim().endsWith('?')).toBe(true);
      }
    }
  );
});
