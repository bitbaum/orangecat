/**
 * Ways to be paid — SSOT for every rail money can reach a person through.
 *
 * Money is a transferable record of energy spent; a rail is a door that
 * record moves through. Every door differs on exactly three axes, and those
 * axes are what this registry encodes (docs/architecture/MONEY_RAILS.md):
 *
 *   identity — what the payer learns about you at the moment of paying.
 *              Fiat rails are identity-bound by law: the payer's app shows
 *              your registered name, and many need your phone number. Bitcoin
 *              and Zcash show a handle and nothing else.
 *   custody  — who holds the money the moment it lands: you, or a provider.
 *   reach    — where in the world people use it, and what it moves.
 *
 * Bitcoin stays the native rail (wallets, invoices, settlement watched by the
 * system) and is described here as BITCOIN_RAIL so the Receive list can state
 * its axes in the same words as every other row. The rest are handles: the
 * pay page shows each with the one action its service has — a link that opens
 * the app with the amount filled in, or the handle to copy — and they settle
 * OUTSIDE OrangeCat. Nothing here is ever marked paid.
 *
 * Pseudonymous by default (AGENTS.md → "Principles"): listing a fiat rail is the
 * opt-in to real identity, so the sheet says what a payer learns before Save,
 * and every row can be `on_request` — shown on the page by name only, the
 * handle shared in a message when the owner decides.
 *
 * Adding a rail is one entry here. The sheet, the public rows, the API's
 * accepted ids and the normaliser all read this list.
 */

export const PAYMENT_METHOD_IDS = [
  // Worldwide
  'paypal',
  'revolut',
  'wise',
  'bank',
  'zcash',
  'other',
  // Europe
  'twint',
  'bizum',
  'wero',
  'tikkie',
  'swish',
  'mobilepay',
  // Americas
  'cashapp',
  'venmo',
  'zelle',
  'interac',
  'pix',
  // Asia & Pacific
  'upi',
  'alipay',
  'wechat',
  'paynow',
  // Africa
  'mpesa',
] as const;

export type PaymentMethodId = (typeof PAYMENT_METHOD_IDS)[number];

export const PAYMENT_REGIONS = {
  worldwide: 'Worldwide',
  europe: 'Europe',
  americas: 'Americas',
  asia_pacific: 'Asia & Pacific',
  africa: 'Africa',
} as const;
export type PaymentRegion = keyof typeof PAYMENT_REGIONS;

/** What the owner types, which decides how it is cleaned and checked. */
export type HandleKind =
  | 'phone'
  | 'username'
  | 'email'
  | 'contact' // email or phone — Zelle, Interac
  | 'iban'
  | 'vpa' // UPI id, name@bank
  | 'key' // PIX key: phone, email, CPF/CNPJ or a random key
  | 'id' // a service's own id: WeChat ID, Alipay account, PayNow
  | 'address' // a Zcash address
  | 'link';

/** A fact about you the payer's app shows them. */
export type RevealedFact = 'name' | 'phone' | 'email' | 'bank_account' | 'handle_only';

/** Who holds the money the moment it lands. */
export type Custody = 'self' | 'provider';

/** Who may see the handle: everyone with the link, or only someone who asked. */
export const PAYMENT_VISIBILITIES = ['public', 'on_request'] as const;
export type PaymentVisibility = (typeof PAYMENT_VISIBILITIES)[number];

/** An amount the payer chose, in the currency they chose it in. */
export interface PayAmount {
  value: number;
  currency: string;
}

export interface PaymentMethodKind {
  id: PaymentMethodId;
  name: string;
  region: PaymentRegion;
  handleKind: HandleKind;
  /** What the owner types in — the service's own words, never ours. */
  handleLabel: string;
  handlePlaceholder: string;
  /** Prefixes people paste along with the handle; stripped before saving. */
  stripPrefixes: readonly string[];
  /** ISO codes this service moves, or 'any' when it depends on the account. */
  currencies: readonly string[] | 'any';
  reveals: readonly RevealedFact[];
  custody: Custody;
  /**
   * The link a tap opens, when the service has one. Receives the amount only
   * when it is in a currency the service takes — a Cash App link with CHF in
   * it would be a number the payer did not choose — and the recipient's name
   * for the schemes that require one (UPI).
   */
  payUrl?: (handle: string, amount?: PayAmount, payee?: string) => string;
}

const money = (amount: PayAmount) => amount.value.toFixed(2);
const WEB = ['https://', 'http://', 'www.'] as const;

export const PAYMENT_METHODS: Record<PaymentMethodId, PaymentMethodKind> = {
  paypal: {
    id: 'paypal',
    name: 'PayPal',
    region: 'worldwide',
    handleKind: 'username',
    handleLabel: 'PayPal.me name',
    handlePlaceholder: 'lena',
    stripPrefixes: [...WEB, 'paypal.me/', '@'],
    currencies: 'any',
    reveals: ['name'],
    custody: 'provider',
    payUrl: (handle, amount) =>
      amount
        ? `https://paypal.me/${handle}/${money(amount)}${amount.currency}`
        : `https://paypal.me/${handle}`,
  },
  revolut: {
    id: 'revolut',
    name: 'Revolut',
    region: 'worldwide',
    handleKind: 'username',
    handleLabel: 'Revolut.me name',
    handlePlaceholder: 'lena',
    stripPrefixes: [...WEB, 'revolut.me/', '@'],
    currencies: 'any',
    reveals: ['name'],
    custody: 'provider',
    payUrl: handle => `https://revolut.me/${handle}`,
  },
  wise: {
    id: 'wise',
    name: 'Wise',
    region: 'worldwide',
    handleKind: 'username',
    handleLabel: 'Wise pay link name',
    handlePlaceholder: 'lena123',
    stripPrefixes: [...WEB, 'wise.com/pay/me/', 'wise.com/pay/', '@'],
    currencies: 'any',
    reveals: ['name'],
    custody: 'provider',
    payUrl: handle => `https://wise.com/pay/me/${handle}`,
  },
  bank: {
    id: 'bank',
    name: 'Bank transfer',
    region: 'worldwide',
    handleKind: 'iban',
    handleLabel: 'IBAN',
    handlePlaceholder: 'CH93 0076 2011 6238 5295 7',
    stripPrefixes: [],
    currencies: 'any',
    reveals: ['name', 'bank_account'],
    custody: 'provider',
  },
  zcash: {
    id: 'zcash',
    name: 'Zcash',
    region: 'worldwide',
    handleKind: 'address',
    handleLabel: 'Zcash address',
    handlePlaceholder: 'u1… or t1…',
    stripPrefixes: ['zcash:'],
    currencies: ['ZEC'],
    reveals: ['handle_only'],
    custody: 'self',
    payUrl: handle => `zcash:${handle}`,
  },
  other: {
    id: 'other',
    name: 'Something else',
    region: 'worldwide',
    handleKind: 'link',
    handleLabel: 'Link or handle',
    handlePlaceholder: 'https://… or a username',
    stripPrefixes: [],
    currencies: 'any',
    reveals: ['name'],
    custody: 'provider',
    // A pasted link opens; anything else is copied.
    payUrl: handle => (/^https?:\/\//i.test(handle) ? handle : ''),
  },

  twint: {
    id: 'twint',
    name: 'Twint',
    region: 'europe',
    handleKind: 'phone',
    handleLabel: 'Phone number',
    handlePlaceholder: '+41 79 123 45 67',
    stripPrefixes: [],
    currencies: ['CHF'],
    reveals: ['name', 'phone'],
    custody: 'provider',
  },
  bizum: {
    id: 'bizum',
    name: 'Bizum',
    region: 'europe',
    handleKind: 'phone',
    handleLabel: 'Phone number',
    handlePlaceholder: '+34 612 34 56 78',
    stripPrefixes: [],
    currencies: ['EUR'],
    reveals: ['name', 'phone'],
    custody: 'provider',
  },
  wero: {
    id: 'wero',
    name: 'Wero',
    region: 'europe',
    handleKind: 'phone',
    handleLabel: 'Phone number',
    handlePlaceholder: '+33 6 12 34 56 78',
    stripPrefixes: [],
    currencies: ['EUR'],
    reveals: ['name', 'phone'],
    custody: 'provider',
  },
  tikkie: {
    id: 'tikkie',
    name: 'Tikkie',
    region: 'europe',
    handleKind: 'link',
    handleLabel: 'Tikkie link',
    handlePlaceholder: 'https://tikkie.me/pay/…',
    stripPrefixes: [],
    currencies: ['EUR'],
    reveals: ['name'],
    custody: 'provider',
    payUrl: handle => (/^https?:\/\//i.test(handle) ? handle : ''),
  },
  swish: {
    id: 'swish',
    name: 'Swish',
    region: 'europe',
    handleKind: 'phone',
    handleLabel: 'Phone number',
    handlePlaceholder: '+46 70 123 45 67',
    stripPrefixes: [],
    currencies: ['SEK'],
    reveals: ['name', 'phone'],
    custody: 'provider',
  },
  mobilepay: {
    id: 'mobilepay',
    name: 'MobilePay',
    region: 'europe',
    handleKind: 'phone',
    handleLabel: 'Phone number',
    handlePlaceholder: '+45 12 34 56 78',
    stripPrefixes: [],
    currencies: ['DKK', 'NOK', 'EUR'],
    reveals: ['name', 'phone'],
    custody: 'provider',
  },

  cashapp: {
    id: 'cashapp',
    name: 'Cash App',
    region: 'americas',
    handleKind: 'username',
    handleLabel: '$Cashtag',
    handlePlaceholder: '$lena',
    stripPrefixes: [...WEB, 'cash.app/', '$'],
    currencies: ['USD', 'GBP'],
    reveals: ['name'],
    custody: 'provider',
    payUrl: (handle, amount) =>
      amount ? `https://cash.app/$${handle}/${money(amount)}` : `https://cash.app/$${handle}`,
  },
  venmo: {
    id: 'venmo',
    name: 'Venmo',
    region: 'americas',
    handleKind: 'username',
    handleLabel: 'Venmo username',
    handlePlaceholder: '@lena',
    stripPrefixes: [...WEB, 'venmo.com/u/', 'venmo.com/', '@'],
    currencies: ['USD'],
    reveals: ['name'],
    custody: 'provider',
    payUrl: (handle, amount) =>
      amount
        ? `https://venmo.com/${handle}?txn=pay&amount=${money(amount)}`
        : `https://venmo.com/${handle}`,
  },
  zelle: {
    id: 'zelle',
    name: 'Zelle',
    region: 'americas',
    handleKind: 'contact',
    handleLabel: 'Email or phone number',
    handlePlaceholder: 'lena@example.com',
    stripPrefixes: [],
    currencies: ['USD'],
    reveals: ['name', 'email'],
    custody: 'provider',
  },
  interac: {
    id: 'interac',
    name: 'Interac e-Transfer',
    region: 'americas',
    handleKind: 'contact',
    handleLabel: 'Email or phone number',
    handlePlaceholder: 'lena@example.com',
    stripPrefixes: [],
    currencies: ['CAD'],
    reveals: ['name', 'email'],
    custody: 'provider',
  },
  pix: {
    id: 'pix',
    name: 'Pix',
    region: 'americas',
    handleKind: 'key',
    handleLabel: 'Pix key',
    handlePlaceholder: 'Phone, email, CPF or random key',
    stripPrefixes: [],
    currencies: ['BRL'],
    reveals: ['name'],
    custody: 'provider',
  },

  upi: {
    id: 'upi',
    name: 'UPI',
    region: 'asia_pacific',
    handleKind: 'vpa',
    handleLabel: 'UPI ID',
    handlePlaceholder: 'lena@upi',
    stripPrefixes: ['upi://pay?pa='],
    currencies: ['INR'],
    reveals: ['name'],
    custody: 'provider',
    // `pn` (payee name) is required by most UPI apps; without it the link is refused.
    payUrl: (handle, amount, payee) =>
      `upi://pay?pa=${encodeURIComponent(handle)}&pn=${encodeURIComponent(payee ?? handle)}&cu=INR${amount ? `&am=${money(amount)}` : ''}`,
  },
  alipay: {
    id: 'alipay',
    name: 'Alipay',
    region: 'asia_pacific',
    handleKind: 'id',
    handleLabel: 'Alipay account',
    handlePlaceholder: 'Phone or email',
    stripPrefixes: [],
    currencies: ['CNY'],
    reveals: ['name'],
    custody: 'provider',
  },
  wechat: {
    id: 'wechat',
    name: 'WeChat Pay',
    region: 'asia_pacific',
    handleKind: 'id',
    handleLabel: 'WeChat ID',
    handlePlaceholder: 'lena_wx',
    stripPrefixes: [],
    currencies: ['CNY'],
    reveals: ['name'],
    custody: 'provider',
  },
  paynow: {
    id: 'paynow',
    name: 'PayNow',
    region: 'asia_pacific',
    handleKind: 'id',
    handleLabel: 'Phone number or UEN',
    handlePlaceholder: '+65 9123 4567',
    stripPrefixes: [],
    currencies: ['SGD'],
    reveals: ['name', 'phone'],
    custody: 'provider',
  },

  mpesa: {
    id: 'mpesa',
    name: 'M-Pesa',
    region: 'africa',
    handleKind: 'phone',
    handleLabel: 'Phone number',
    handlePlaceholder: '+254 712 345 678',
    stripPrefixes: [],
    currencies: ['KES', 'TZS'],
    reveals: ['name', 'phone'],
    custody: 'provider',
  },
};

/**
 * The native rail, in the same words as the rows above, so the Receive list
 * can say what a payer learns on every row including this one.
 */
export const BITCOIN_RAIL = {
  name: 'Bitcoin',
  reveals: ['handle_only'] as const satisfies readonly RevealedFact[],
  custody: 'self' as const satisfies Custody,
};

/** The sheet's order: one group per region, in this order. */
export const PAYMENT_REGION_ORDER: readonly PaymentRegion[] = [
  'worldwide',
  'europe',
  'americas',
  'asia_pacific',
  'africa',
];

/** Rails of one region, in registry order. */
export function paymentMethodsIn(region: PaymentRegion): PaymentMethodKind[] {
  return PAYMENT_METHOD_IDS.map(id => PAYMENT_METHODS[id]).filter(kind => kind.region === region);
}

export const PAYMENT_HANDLE_MAX_LENGTH = 160;
export const PAYMENT_LABEL_MAX_LENGTH = 40;
/** Enough for every service a person realistically uses, few enough to read. */
export const PAYMENT_METHODS_MAX_PER_ACCOUNT = 12;

export function isPaymentMethodId(value: string): value is PaymentMethodId {
  return (PAYMENT_METHOD_IDS as readonly string[]).includes(value);
}

export function isPaymentVisibility(value: string): value is PaymentVisibility {
  return (PAYMENT_VISIBILITIES as readonly string[]).includes(value);
}

/**
 * Where a tap on a method takes the payer, or '' when the method has no link
 * and the handle is copied instead. The amount is passed through only when the
 * service takes that currency.
 */
export function paymentMethodUrl(
  method: PaymentMethodId,
  handle: string,
  amount?: PayAmount,
  payee?: string
): string {
  const kind = PAYMENT_METHODS[method];
  if (!kind.payUrl) {
    return '';
  }
  const takesCurrency =
    amount &&
    amount.value > 0 &&
    (kind.currencies === 'any' || kind.currencies.includes(amount.currency));
  return kind.payUrl(handle, takesCurrency ? amount : undefined, payee);
}

const FACT_WORDS: Record<RevealedFact, string> = {
  name: 'your name',
  phone: 'your phone number',
  email: 'your email',
  bank_account: 'your bank account',
  handle_only: '',
};

/**
 * "A payer learns your name and your phone number." — the sentence the owner
 * reads before listing a rail, and again on its row. Built from the facts so
 * it cannot drift from what the registry says.
 */
export function payerLearns(reveals: readonly RevealedFact[], handle = 'this handle'): string {
  if (reveals.includes('handle_only')) {
    return `A payer learns only ${handle}.`;
  }
  const words = reveals.map(fact => FACT_WORDS[fact]).filter(Boolean);
  const list =
    words.length <= 1 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
  return `A payer learns ${list}.`;
}

export const PAYMENT_METHODS_COPY = {
  /** The list heading on /receive. */
  heading: 'Ways to pay you',
  bitcoinArrives: (destination: string) => `Lands in ${destination}`,
  bitcoinArrivesInApp: 'Lands in the wallet you connected',
  bitcoinNotSetUp: 'Not set up — payers see the other ways',
  add: 'Add a way to be paid',
  addTitle: 'Add a way to be paid',
  labelField: 'Label (optional)',
  labelPlaceholder: 'Business account',
  visibilityLabel: 'Who sees it',
  visibility: {
    public: { label: 'On my pay page', consequence: 'Anyone with your link sees it.' },
    on_request: {
      label: 'Only when asked',
      consequence: 'Your page shows the name only. A payer taps Ask; you answer in a message.',
    },
  },
  /** The row's own word for its visibility. */
  visibilityWord: { public: 'On your page', on_request: 'On request' },
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
  sharedOnRequest: (name: string) => `${name} shares the details when asked`,
  open: 'Open',
  copy: 'Copy',
  copied: 'Copied',
  ask: 'Ask',
  invalidHandle: (label: string) => `That does not look like a ${label.toLowerCase()}.`,
  tooMany: `You can list up to ${PAYMENT_METHODS_MAX_PER_ACCOUNT} ways to be paid.`,
} as const;
