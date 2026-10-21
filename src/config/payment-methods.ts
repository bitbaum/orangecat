/**
 * Ways to be paid — SSOT for every payment method that is not a Bitcoin wallet.
 *
 * OrangeCat is currency-agnostic by principle (`.claude/CLAUDE.md` → "Any
 * currency"): Bitcoin is the native rail, the one that mints invoices and
 * settles by itself, but a person is paid in whatever the payer has. So an
 * account lists every door it accepts money through — Twint, PayPal, a bank,
 * Cash App — and the pay page shows them all, each with the one action its
 * service supports: a link that opens the app with the amount filled in, or a
 * handle to copy into it.
 *
 * Honesty rule: these settle OUTSIDE OrangeCat. We cannot see them land, so the
 * copy never says "paid" about them; the owner confirms in their own app.
 *
 * Adding a method is one entry here. The add sheet, the public rows, the API's
 * accepted ids and the Cat's description all read this list.
 */

export const PAYMENT_METHOD_IDS = [
  'twint',
  'paypal',
  'revolut',
  'cashapp',
  'venmo',
  'wise',
  'bank',
  'other',
] as const;

export type PaymentMethodId = (typeof PAYMENT_METHOD_IDS)[number];

/** An amount the payer chose, in the currency they chose it in. */
export interface PayAmount {
  value: number;
  currency: string;
}

export interface PaymentMethodKind {
  id: PaymentMethodId;
  /** The name people know it by. */
  name: string;
  /** What the owner types in — in their words, never ours. */
  handleLabel: string;
  handlePlaceholder: string;
  /** Prefixes people paste along with the handle; stripped before saving. */
  stripPrefixes: readonly string[];
  /** ISO codes this service moves, or 'any' when it depends on the account. */
  currencies: readonly string[] | 'any';
  /**
   * The link a tap opens, when the service has one. Receives the amount only
   * when it is in a currency the service takes — a Cash App link with CHF in it
   * would be a number the payer did not choose.
   */
  payUrl?: (handle: string, amount?: PayAmount) => string;
}

const money = (amount: PayAmount) => amount.value.toFixed(2);

export const PAYMENT_METHODS: Record<PaymentMethodId, PaymentMethodKind> = {
  twint: {
    id: 'twint',
    name: 'Twint',
    handleLabel: 'Phone number',
    handlePlaceholder: '+41 79 123 45 67',
    stripPrefixes: [],
    currencies: ['CHF'],
  },
  paypal: {
    id: 'paypal',
    name: 'PayPal',
    handleLabel: 'PayPal.me name',
    handlePlaceholder: 'lena',
    stripPrefixes: ['https://', 'http://', 'www.', 'paypal.me/', '@'],
    currencies: ['USD', 'EUR', 'CHF', 'GBP'],
    payUrl: (handle, amount) =>
      amount
        ? `https://paypal.me/${handle}/${money(amount)}${amount.currency}`
        : `https://paypal.me/${handle}`,
  },
  revolut: {
    id: 'revolut',
    name: 'Revolut',
    handleLabel: 'Revolut.me name',
    handlePlaceholder: 'lena',
    stripPrefixes: ['https://', 'http://', 'www.', 'revolut.me/', '@'],
    currencies: ['USD', 'EUR', 'CHF', 'GBP'],
    payUrl: handle => `https://revolut.me/${handle}`,
  },
  cashapp: {
    id: 'cashapp',
    name: 'Cash App',
    handleLabel: '$Cashtag',
    handlePlaceholder: '$lena',
    stripPrefixes: ['https://', 'http://', 'www.', 'cash.app/', '$'],
    currencies: ['USD', 'GBP'],
    payUrl: (handle, amount) =>
      amount ? `https://cash.app/$${handle}/${money(amount)}` : `https://cash.app/$${handle}`,
  },
  venmo: {
    id: 'venmo',
    name: 'Venmo',
    handleLabel: 'Venmo username',
    handlePlaceholder: '@lena',
    stripPrefixes: ['https://', 'http://', 'www.', 'venmo.com/u/', 'venmo.com/', '@'],
    currencies: ['USD'],
    payUrl: (handle, amount) =>
      amount
        ? `https://venmo.com/${handle}?txn=pay&amount=${money(amount)}`
        : `https://venmo.com/${handle}`,
  },
  wise: {
    id: 'wise',
    name: 'Wise',
    handleLabel: 'Wise pay link name',
    handlePlaceholder: 'lena123',
    stripPrefixes: ['https://', 'http://', 'www.', 'wise.com/pay/me/', 'wise.com/pay/', '@'],
    currencies: 'any',
    payUrl: handle => `https://wise.com/pay/me/${handle}`,
  },
  bank: {
    id: 'bank',
    name: 'Bank transfer',
    handleLabel: 'IBAN',
    handlePlaceholder: 'CH93 0076 2011 6238 5295 7',
    stripPrefixes: [],
    currencies: 'any',
  },
  other: {
    id: 'other',
    name: 'Something else',
    handleLabel: 'Link or handle',
    handlePlaceholder: 'https://… or a username',
    stripPrefixes: [],
    currencies: 'any',
    // A pasted link opens; anything else is copied.
    payUrl: handle => (/^https?:\/\//i.test(handle) ? handle : ''),
  },
};

/** The order the add sheet offers them in — most used in Switzerland first. */
export const PAYMENT_METHOD_ORDER: readonly PaymentMethodId[] = PAYMENT_METHOD_IDS;

export const PAYMENT_HANDLE_MAX_LENGTH = 160;
export const PAYMENT_LABEL_MAX_LENGTH = 40;
/** Enough for every service a person realistically uses, few enough to read. */
export const PAYMENT_METHODS_MAX_PER_ACCOUNT = 12;

export function isPaymentMethodId(value: string): value is PaymentMethodId {
  return (PAYMENT_METHOD_IDS as readonly string[]).includes(value);
}

/**
 * Where a tap on a method takes the payer, or '' when the method has no link
 * and the handle is copied instead. The amount is passed through only when the
 * service takes that currency.
 */
export function paymentMethodUrl(
  method: PaymentMethodId,
  handle: string,
  amount?: PayAmount
): string {
  const kind = PAYMENT_METHODS[method];
  if (!kind.payUrl) {
    return '';
  }
  const takesCurrency =
    amount &&
    amount.value > 0 &&
    (kind.currencies === 'any' || kind.currencies.includes(amount.currency));
  return kind.payUrl(handle, takesCurrency ? amount : undefined);
}

export const PAYMENT_METHODS_COPY = {
  /** The list heading on /receive. */
  heading: 'Ways to pay you',
  bitcoinRow: 'Bitcoin',
  bitcoinArrives: (destination: string) => `Arrives at ${destination}`,
  bitcoinArrivesInApp: 'Arrives in the wallet you connected',
  bitcoinNotSetUp: 'Not set up — payers see the other ways',
  add: 'Add a way to be paid',
  addTitle: 'Add a way to be paid',
  pickTitle: 'Which service?',
  labelField: 'Label (optional)',
  labelPlaceholder: 'Business account',
  save: 'Save',
  saving: 'Saving…',
  remove: 'Remove',
  removed: 'Removed.',
  /** Under the list: why these rows differ from the Bitcoin one. */
  outsideNote: 'These are paid in their own apps. OrangeCat shows them; it cannot see them arrive.',
  /** On the public pay page, above the owner's other methods. */
  publicHeading: (name: string) => `Other ways to pay ${name}`,
  publicOnlyHeading: (name: string) => `Pay ${name} with`,
  publicNote: (name: string) => `Paid in that app, straight to ${name}. OrangeCat never holds it.`,
  open: 'Open',
  copy: 'Copy',
  copied: 'Copied',
  invalidHandle: (label: string) => `That does not look like a ${label.toLowerCase()}.`,
  tooMany: `You can list up to ${PAYMENT_METHODS_MAX_PER_ACCOUNT} ways to be paid.`,
} as const;
