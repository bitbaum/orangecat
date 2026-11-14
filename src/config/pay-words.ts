/**
 * The words of the pay machine's states — a leaf, so both the pay link
 * (src/config/pay.ts) and the support dialog (src/config/tips.ts) can spread
 * them without importing each other. A state has one wording: "Waiting for the
 * payment…" was also "Waiting for the tip…", and "This code expired" was also
 * "This tip request expired".
 */

export const PAY_STATE_WORDS = {
  /** The honesty line — we never hold funds. */
  disclaimer: 'Paid directly to them. OrangeCat takes 0% and never touches your funds.',
  /**
   * The code screen puts "Open in wallet" first on a phone and the code one
   * more tap away, so no label promises the code.
   */
  generate: 'Pay with a Bitcoin wallet',
  /** Beside "Pay from my wallet": a different wallet from the one connected. */
  generateOther: 'Pay from another wallet',
  enterAmount: 'Enter an amount',
  generating: 'Preparing…',
  scan: 'Waiting for the payment…',
  again: 'Change amount',
  paidTitle: 'Paid',
  paidBody: (name: string) => `Paid straight to ${name}'s wallet.`,
  expiredTitle: 'This code expired',
  expiredBody: 'Nothing was sent. You can make another.',
  /** For a payer who is signed in with a wallet connected: pay without leaving. */
  payFromWallet: 'Pay from my wallet',
  payFromWalletNote: "They'll see it was you.",
  payingFromWallet: 'Paying from your wallet…',
  confirming: 'Paid. Confirming…',
  /** The wallet said no: the code is still there, so there is no dead end. */
  walletDeclined: (reason: string) =>
    `Your wallet couldn't pay this: ${reason} You can pay the code below from another wallet.`,
} as const;
