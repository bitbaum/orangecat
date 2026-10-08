/** Copy for the personal finances overview. */
export const FINANCES_PAGE = {
  title: 'Your money, in one place',
  lede: 'What came in, what you owe, where you said your public money should go, and what the public would take. Estimates are marked as estimates.',
  income: {
    title: 'Came in',
    hint: (days: number) =>
      `Settled payments in the last ${days} days, each valued at the price when it arrived.`,
    valuedAtToday: (n: number) =>
      n === 1
        ? '1 payment had no price recorded when it arrived and is valued at today’s rate.'
        : `${n} payments had no price recorded when they arrived and are valued at today’s rate.`,
    empty: 'Nothing has come in yet. Sell something, offer a service, or get paid by link.',
  },
  debts: {
    title: 'You owe',
    empty: 'No open loans.',
    monthly: 'a month',
  },
  civic: {
    title: 'Where your public money should go',
    empty: 'You have not declared a split yet.',
    cta: 'Declare it',
    edit: 'Change it',
  },
} as const;
