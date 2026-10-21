# Money, rails, and the three axes

**Created:** 2026-10-21
**SSOT for:** why `src/config/payment-methods.ts` is shaped the way it is, and
what a "way to be paid" means on OrangeCat.

## What money is, as far as a payment surface needs to know

Energy is spent — hours, attention, fuel, risk — and the world keeps a record
of who spent it for whom. Money is that record made transferable: a claim on
energy somebody else will spend later, which you can hand on without the
original spender in the room. Value is the energy; money is the ledger entry;
a currency is the unit one ledger counts in.

Every ledger has rules about three things, and those three are the whole
difference between one way of being paid and another:

| Axis         | The question                                               | Why it is the payer's business                                         |
| ------------ | ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Identity** | What does the payer learn about you when they pay?         | Fiat ledgers are identity-bound by law. Bitcoin's and Zcash's are not. |
| **Custody**  | Who holds the entry the moment it lands?                   | A provider can freeze, reverse, or close it. You cannot be.            |
| **Reach**    | Where is this ledger used, and what unit does it count in? | A Twint number is useless in Lagos; M-Pesa is useless in Bern.         |

Everything else about a rail — its logo, whether it has a deep link, whether
it needs a phone number — is a consequence of one of these three.

## What that means for the surface

**A person is paid through doors, and lists their doors.** Bitcoin is the
native door: OrangeCat mints the invoice, watches it settle, and the money
lands in the owner's own wallet. Every other door is a handle the owner
writes down and the pay page shows — Twint, PayPal, UPI, Pix, M-Pesa. They
settle in their own apps. OrangeCat shows them and never claims to have seen
them land. The surface is currency-agnostic by principle
(`.claude/CLAUDE.md` → "Any currency") and this is where the principle is a
list rather than a sentence.

**Identity is stated, never discovered.** Listing a fiat rail is the opt-in
to real identity, because the payer's app will show your registered name
whatever OrangeCat does. So the registry carries `reveals` per rail, the add
sheet says _"A payer learns your name and your phone number"_ above Save, and
the row says it again. The Bitcoin row says _"A payer learns only @cato"_ in
the same words, so the difference is visible as a property, not as a vibe.

**A handle can be shown or shared.** `visibility` is `public` (printed on the
page) or `on_request` (the page shows the rail by name; the payer taps Ask,
which opens a message to the owner, who decides). The handle of an
`on_request` row never leaves the server for a public reader
(`toPublicPaymentMethod`). Phone-shaped rails default to `on_request`: a
number is the thing people regret printing. This is "private where needed,
transparent where chosen" made into a column.

**The amount travels when the ledger takes it.** A link gets the payer's
amount only in a currency that rail counts in (`paymentMethodUrl`): Cash App
opens with "20.00" for USD and with nothing for CHF, rather than a number the
payer did not choose.

## How the registry is built

One entry per rail in `PAYMENT_METHODS`, carrying exactly the axes plus what
a form needs:

- `region` + `currencies` — reach. The sheet groups by region, worldwide first.
- `reveals` + `custody` — identity and custody. `payerLearns(reveals)` is the
  one sentence builder; copy never restates the facts.
- `handleKind` — what the owner types (`phone`, `username`, `iban`, `vpa`,
  `key`, …). Validation is by kind, in `lib/payments/payment-handle.ts`, so a
  new rail gets it for free; a per-service switch is what used to drift.
- `stripPrefixes` + `payUrl` — the packaging people paste, and the link a tap
  opens, when the service has one.

`BITCOIN_RAIL` describes the native rail on the same axes so the Receive list
can speak about it in the same words. It is not a row: its data is the
wallet, not a handle.

Adding a rail is one entry. The sheet, the public rows, the API's accepted
ids, the normaliser and the Cat's description read the list. Do not add a
second list of rails anywhere; do not add a column that is not one of the
three axes or a form need.

## What this is not

- Not a settlement engine for fiat. Nothing marks a Twint payment paid. If a
  rail ever reports settlement to us, that is a new property on the entry
  (`settles: 'observed' | 'claimed'`), not a new list.
- Not a wallet. "Wallet" is the subset of ways to be paid that OrangeCat can
  mint an invoice against. See `WALLET_SYSTEM_SUMMARY.md`.
- Not a place for logos. Colour and marks belong to the services; a row is a
  name, a handle, and the identity cost, in the system's own type.
