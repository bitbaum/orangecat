/**
 * Sending — SSOT for the outbound payment surface (/send).
 *
 * Who first, then amount once that person checks out. The note stays closed
 * until opened. Bounds are shared with pay links so a link someone can create
 * is always a link someone can pay.
 */

export const SEND_NOTE_MAX_LENGTH = 120;

export const SEND_COPY = {
  title: 'Send Bitcoin',
  subtitle: 'Pay a person, or an invoice someone gave you.',

  personTab: 'To a person',
  invoiceTab: 'Paste invoice',

  recipientLabel: 'Username or Lightning address',
  recipientPlaceholder: 'lena or lena@orangecat.ch',
  memoLabel: 'Note (optional)',
  memoPlaceholder: "What's it for?",

  /** Live recipient resolution — a wrong name must fail loudly, before sending. */
  recipientChecking: 'Looking them up…',
  recipientReady: (name: string) => `Paying ${name}.`,
  recipientExternal:
    "Lightning address — we'll pay it directly. Check the spelling: we can't tell you who owns it.",
  recipientNotFound: (handle: string) => `Nobody on OrangeCat goes by @${handle}.`,
  recipientCannotReceive: (name: string) => `${name} can't receive Bitcoin yet.`,

  invoiceLabel: 'Lightning invoice',
  invoicePlaceholder: 'Paste an invoice starting with lnbc…',
  /** Shown once we have read the invoice — consent before spending. */
  invoiceReads: (amount: string) => `This invoice is for ${amount}.`,
  invoiceUnreadable: "We can't read an amount from that invoice.",
  invoiceWrongNetwork: (network: string) => `That is a ${network} invoice, not a real-Bitcoin one.`,

  review: 'Review payment',
  reviewTitle: 'Check this is right',
  reviewIntro: 'Bitcoin payments are final. There is no undo.',
  reviewTo: 'To',
  reviewAmount: 'Amount',
  reviewNote: 'Note',
  back: 'Back',
  confirm: 'Send payment',
  sending: 'Sending…',

  sentTitle: 'Sent',
  sentFallback: 'The payment went through.',
  again: 'Send another',

  noWalletTitle: 'Connect a wallet to send',
  noWalletBody:
    'Sending needs a wallet OrangeCat can ask to pay — any NWC-compatible Lightning wallet. Your keys stay yours.',
  noWalletCta: 'Set up a wallet',

  /** Shown when sending is broken on our side — never blame the payer's wallet. */
  unavailableTitle: 'Sending is paused right now',

  /** Honesty line: we ask the user's own wallet to pay; we never hold funds. */
  disclaimer: 'Paid from your own wallet. OrangeCat never holds your Bitcoin.',
} as const;
