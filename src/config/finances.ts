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
  routes: {
    title: 'Where your money goes',
    lede: 'When someone pays you, the whole payment goes to the first line below that is still behind. OrangeCat never holds it — the payer’s wallet pays that wallet directly.',
    scope:
      'This covers money sent to you — through your profile, your Lightning address, tips and requests. A project or listing with its own wallet keeps receiving there.',
    empty:
      'No rule yet: payments land in your usual wallet. Put taxes first, then a debt, then rent — in the order you want them covered.',
    setUp: 'Set it up',
    edit: 'Change the order or amounts',
    next: 'Next payment',
    covered: {
      share: 'Holds its share',
      once: 'Covered',
      monthly: 'Covered this month',
    },
    satisfied: 'Every line is covered — payments now land in your usual wallet.',
    noWallets: 'Add a wallet first — each line sends money to one of your wallets.',
    walletsHref: '/wallets',
    walletsCta: 'Add a wallet',
    share: (percent: number) => `${percent}% of everything that comes in`,
    fillOnce: (amount: string) => `${amount}, once`,
    fillMonthly: (amount: string) => `${amount} every month`,
    holds: (received: string, target: string) => `${received} of ${target}`,
    unvalued: (n: number) =>
      n === 1
        ? '1 payment here has no price yet and is not counted.'
        : `${n} payments here have no price yet and are not counted.`,
    form: {
      wallet: 'Wallet',
      kind: 'How much',
      share: 'A share of everything',
      fill: 'An amount',
      percent: 'Percent',
      amount: 'Amount',
      currency: 'Currency',
      period: 'How often',
      once: 'Once',
      monthly: 'Every month',
      add: 'Add a line',
      remove: 'Remove line',
      up: 'Move up',
      down: 'Move down',
      save: 'Save the order',
      cancel: 'Cancel',
      saved: 'Saved. The next payment follows the new order.',
    },
  },
} as const;
