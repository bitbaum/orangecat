/**
 * The shape of a person's money rule as they send it — one ordered list.
 *
 * The list order IS the waterfall. Shares are given in percent (the database
 * stores basis points); fills name an amount and a currency OrangeCat prices
 * in. Shares together may not exceed 100% of what comes in.
 */
import { z } from 'zod';
import { CURRENCY_CODES } from '@/config/currencies';

export const MAX_ROUTE_LINES = 12;

const shareLine = z.object({
  walletId: z.string().uuid(),
  kind: z.literal('share'),
  /** Percent of everything that comes in, e.g. 25 or 12.5. */
  sharePercent: z.number().min(0.01).max(100),
});

const fillLine = z.object({
  walletId: z.string().uuid(),
  kind: z.literal('fill'),
  targetAmount: z.number().positive().max(1_000_000_000),
  targetCurrency: z.enum(CURRENCY_CODES),
  period: z.enum(['once', 'monthly']).default('once'),
});

export const routeLineSchema = z.discriminatedUnion('kind', [shareLine, fillLine]);

export const moneyRulesInputSchema = z
  .object({ lines: z.array(routeLineSchema).max(MAX_ROUTE_LINES) })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    value.lines.forEach((line, i) => {
      if (seen.has(line.walletId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['lines', i, 'walletId'],
          message: 'A wallet can appear only once in the rule.',
        });
      }
      seen.add(line.walletId);
    });
    const shares = value.lines.reduce((n, l) => n + (l.kind === 'share' ? l.sharePercent : 0), 0);
    if (shares > 100) {
      ctx.addIssue({
        code: 'custom',
        path: ['lines'],
        message: 'Shares add up to more than 100% of what comes in.',
      });
    }
  });

export type MoneyRulesInput = z.infer<typeof moneyRulesInputSchema>;
export type RouteLineInput = z.infer<typeof routeLineSchema>;

/** Percent → basis points, exact to the hundredth of a percent. */
export function toBps(percent: number): number {
  return Math.round(percent * 100);
}
