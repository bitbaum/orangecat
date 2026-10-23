/**
 * Sending — SSOT for the outbound payment surface (/send).
 *
 * Who first, then amount once that person checks out. The note stays closed
 * until opened. Bounds are shared with pay links so a link someone can create
 * is always a link someone can pay.
 */

export const SEND_NOTE_MAX_LENGTH = 120;

export const SEND_COPY = {
  title: 'Send',
  subtitle: 'Pay a person, an address, or an invoice. From your own wallet.',

  recipientLabel: 'To',
  recipientPlaceholder: 'Name, lena@wallet.com or an invoice',
  scan: 'Scan a code',
  scanTitle: 'Scan a code to pay',
  memoLabel: 'Note',
  memoAdd: 'Add a note',
  memoPlaceholder: "What's it for?",

  /** Live recipient resolution — a wrong name must fail loudly, before sending. */
  recipientChecking: 'Looking them up…',
  recipientReady: (name: string) => `Paying ${name}.`,
  recipientExternal:
    "Lightning address — we'll pay it directly. Check the spelling: we can't tell you who owns it.",
  recipientNotFound: (handle: string) => `Nobody on OrangeCat goes by @${handle}.`,
  /** Why: OrangeCat pays into the recipient's own wallet, and they have not connected one. */
  recipientCannotReceive: (name: string) =>
    `${name} hasn't added a Bitcoin wallet yet, so a payment has nowhere to land.`,
  recipientSelf: "That's you. Pick someone else to pay.",
  recipientOnchainOnly: (name: string) =>
    `${name} receives on-chain only, which Send can't pay yet. Their pay page can.`,
  recipientOnchainLink: (name: string) => `Open ${name}'s pay page`,
  /** The way forward, one line: a message is written for you, you decide whether to send it. */
  recipientNudge: (name: string) => `Message ${name} to suggest adding one`,

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

  /** A send that timed out is not a "no": the wallet may still be paying. */
  unconfirmedTitle: 'Not confirmed yet',
  unconfirmedBody:
    "We couldn't confirm this payment in time, so it may still go through. Check your wallet's history before paying again.",
  unconfirmedDone: 'Back to Send',

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
