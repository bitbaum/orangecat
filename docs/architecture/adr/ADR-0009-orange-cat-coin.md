# ADR-0009: Orange Cat Coin — Bitcoin's Energy, Made Fungible

Date: 2026-09-14
Status: Proposed
Supersedes nothing. Constrains: `src/config/public-content.ts` (privacy-coin
copy stays "not available now" until Stage 1 ships), `docs/architecture/CAT_CREDITS.md`
(the BTC-only denomination rule applies here too).

## The ask

OrangeCat should have its own coin: the ultimate privacy coin, for value
exchange between free individuals. Monero, Zcash, Pirate Chain and the
Mimblewimble family are the reference points. Bitcoin stays the public,
transparent ledger. The coin should be a first-principles reading of what
value is and what energy is.

This ADR takes the ask seriously, surveys the field, and lands on a design that
is _more_ radical than a new coin, not less: **Orange Cat Coin is not a new
asset. It is Bitcoin wearing a mask.**

## First principles

**Value is not in the thing.** It is the ratio at which someone will give up
one thing for another. That is subjective, per person, per moment, and no
protocol can encode it. What a protocol _can_ encode is **cost**.

**Energy is the only cost that cannot be faked.** Every other scarcity is a
rule, and rules are changed by whoever holds the pen. A joule dissipated is
gone whoever you are. Proof-of-work ties a ledger to joules: every unit was
bought with energy that no longer exists. That is what "hard money" means at
the physical level, and it is the property Bitcoin has that nothing else on this
list has at comparable scale (Bitcoin's hashrate is roughly five orders of
magnitude above the largest PoW privacy coin; every proof-of-stake coin is
secured by its own token, which is circular).

**Money is the memory of cost.** A ledger that remembers how much was spent lets
strangers settle without trusting each other.

**Fungibility is the memory of cost with the names forgotten.** A coin that
remembers _who_ spent it is not money yet; it is a receipt. Tainted coins trade
below clean coins, exchanges freeze "risky" UTXOs, and a payment carries the
history of every prior holder. Privacy is not a feature layered onto money. It
is the precondition for any unit being worth the same as any other unit.

So the ideal money remembers everything about _how much_ and nothing about
_whom_. Bitcoin has the first property at civilisational scale and lacks the
second. Every privacy coin has the second property and reinvents the first,
badly, with a security budget a few thousand GPUs can overturn.

**The first-principles conclusion: do not build a second energy anchor.
Inherit Bitcoin's, and add the forgetting.** The cat remembers the cost and
forgets the name.

## The field (what each one actually does)

| Design                                   | Mechanism                                                        | Anonymity set                      | Trusted setup                        | Chosen transparency                 | Interactive | Known weakness                                                                                                              |
| ---------------------------------------- | ---------------------------------------------------------------- | ---------------------------------- | ------------------------------------ | ----------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------- |
| Monero RingCT (today)                    | Ring signatures with 16 decoys, stealth addresses, Bulletproofs+ | 16 per input, probabilistic        | None                                 | View keys                           | No          | Decoy selection is heuristic; chain-analysis and "Eve-Alice-Eve" attacks degrade it; fixed small set                        |
| Monero FCMP++ (in progress)              | Full-chain membership proofs over a curve tree                   | Every output on the chain          | None                                 | View keys                           | No          | Not yet shipped; heavier proofs; still a separate PoW ledger                                                                |
| Zcash Orchard                            | Halo 2 zk-SNARK on the Pallas/Vesta cycle, shielded notes        | Every note in the Orchard pool     | None (Sapling and Sprout needed one) | Viewing keys and payment disclosure | No          | Privacy is optional at the protocol level, so most historical activity leaked through transparent addresses; a PoW altcoin  |
| Pirate Chain                             | Zcash Sapling with shielding mandatory                           | Whole pool                         | Inherited Sapling MPC                | Viewing keys                        | No          | No new cryptography; tiny security budget                                                                                   |
| Mimblewimble (Grin, Beam, Litecoin MWEB) | Pedersen commitments, no addresses, cut-through                  | Weak: the transaction graph is visible at broadcast | None                    | None built in                        | Yes         | Bogatyy (2019) linked 96% of Grin transactions with one sniffer node; both parties must be online; no scripting              |
| Lelantus Spark (Firo)                    | One-out-of-many proofs, Spark addresses                          | Whole anonymity set                | None                                 | Incoming and full view keys         | No          | Solid but mid-field; small ledger                                                                                            |
| Chaumian ecash (Cashu, Fedimint)         | Blind signatures (Chaum 1983, BDHKE), bearer notes backed by BTC | Every note of a denomination the mint has issued | None                   | Payer can reveal a note and its DLEQ proof | No     | **The mint is a custodian.** It cannot link, but it can lose or steal the backing. Federation spreads, not removes, the risk |
| Bitcoin L1 hygiene (BIP352, payjoin, coinjoin, Lightning) | Address reuse avoidance, input mixing, routed payments | Small and probabilistic       | None                                 | Full, it is the public ledger       | Varies      | Improves privacy; never reaches fungibility                                                                                  |

Ranked on cryptographic privacy alone: **Zcash Orchard and Monero FCMP++** are
the state of the art and converge on the same shape (a zero-knowledge proof that
"I own one of every output that ever existed", no trusted setup, viewing keys
for disclosure). Chaumian ecash is stronger than both on _unlinkability_ (the
mint cannot link even with unbounded compute; it is information-theoretic, not
computational) and weaker than both on _custody_ (the mint holds the bitcoin).
Mimblewimble is the weakest on privacy and is disqualified.

Ranked on the energy principle: every design in the table except ecash and L1
hygiene is a separate ledger with its own security budget. That is the
disqualifying property for a "coin", not a detail.

## Decision

**Orange Cat Coin (OCC) is a privacy-preserving bearer form of Bitcoin.** One
unit of OCC is one unit of BTC, held in the same `NUMERIC(18,8)` BTC
denomination as everything else on the platform. There is no new supply, no
issuance, no ticker to list, no premine, no security budget to fund. The "coin"
is the mask, not a new animal.

It is built in three stages. Each stage is useful alone and each strictly
improves the custody story of the one before.

### Stage 1 — OCC as Chaumian ecash on Lightning

OrangeCat runs a Cashu mint. Peg-in is paying a Lightning invoice; the user
receives blind-signed notes. Peg-out is melting notes to any Lightning invoice.
Between the two, notes move peer to peer as bearer tokens: in a Cat
conversation, in a direct message, over Nostr (NIP-60 wallets, NIP-61
"nutzaps"), or as a QR code. The mint sees a deposit and later a withdrawal and
cannot connect them to each other, let alone to a transfer in between.

Why this first:

- It runs on the rails the platform already has (NWC receive wallet, Lightning
  settlement polling, the append-only ledger pattern from Cat Credits).
- The Cat can hold and spend it as an agent without touching a key that
  controls on-chain funds. A NIP-60 wallet is the Cat's natural purse.
- Sub-satoshi-cost transfers, instant, offline-verifiable by the receiver
  through the DLEQ proof, no channel liquidity to manage.
- Bitcoin is already the "any currency" answer; this makes it a fungible one.

What it costs, said plainly: **the mint is a custodian.** This is the first
place the platform would hold user bitcoin, and it contradicts the rule in
`CAT_CREDITS.md` that user funds stay non-custodial. Stage 1 is a deliberate,
labelled exception with hard limits, not a change of principle:

- The mint is open source, its keysets are published, and it publishes proof of
  liabilities against its Lightning balance.
- Balances are meant to be transient: a soft cap per user and nudges to melt out
  keep the float small. OCC is a purse, not a savings account.
- The platform's own copy keeps saying "not available now" until this ships;
  nothing in `public-content.ts` changes on the strength of this ADR.
- Legal review before launch. An ecash issuer in Switzerland is plausibly an
  issuer of a payment instrument under FINMA rules and plausibly an e-money
  token under MiCA for EU users. That is a question for counsel, not a reason
  to skip the stage, and not one this document can answer.

### Stage 2 — Federated mint under Solon

Replace the single mint with a Fedimint-style federation. Guardians are
distinct humans elected through Solon, with a threshold of them needed to sign
or to move the backing. Guardian membership is a `MEMBERSHIP` decision and the
federation's safety parameters are `SAFETY` decisions, which Solon already
reserves for humans and denies to agent members. Solon's own treasury stays
watch-only; guardians hold federation keys, never the Solon treasury.

This does not remove custody. It removes the single point of custody, and it
puts the people who hold the keys under the governance layer that already
exists instead of under the platform operator.

### Stage 3 — A shielded pool with cryptographic, not custodial, privacy

The end state is an Orchard-shaped shielded pool whose notes are BTC: a Halo 2
(or FCMP++-style curve-tree) membership proof, no trusted setup, anonymity set
of every note ever created, viewing keys and payment disclosures for chosen
transparency. This is the design the field has converged on and it is the only
one that gives "ultimate privacy" without an issuer.

It is Stage 3 and not Stage 1 because the unsolved part is the peg, not the
privacy. Every two-way peg to Bitcoin that exists today is either a federation
(which is Stage 2 with more steps) or a BitVM-class construction that is still
being proven in production. Client-side-validated assets (RGB, Taproot Assets)
give ownership proofs but not a shielded pool. When a trust-minimised peg
exists, Stage 3 replaces the federation and OCC becomes bearer bitcoin that
nobody holds for you. Until then Stage 3 is research, and it should be
described as research.

### What was rejected, and why

- **A new layer-one privacy coin (fork Monero, fork Zcash, or from scratch).**
  A second energy anchor with a tiny security budget, a token the platform
  would have to list, market-make and defend, MiCA and FINMA exposure as an
  issuer, and a split of the public fund-to-build audit trail into two assets.
  The first-principles argument above disqualifies it before the engineering
  does.
- **Mimblewimble.** Weakest privacy in the table, interactive transactions, and
  the linkability attack is not theoretical.
- **A token on an EVM or Solana chain.** Not Bitcoin-native, gas denominated in
  another asset, and privacy would still have to be added (Railgun, Aztec) on
  top of a base layer that broadcasts everything.
- **"Just use Lightning."** Lightning is good privacy for the sender and poor
  for the receiver, and it is not fungible. It stays the peg-in and peg-out
  rail, not the coin.

## How this coexists with the transparent ledger

The public fund-to-build loop stays on public Bitcoin. A project's funding
address is auditable by anyone because that is the product. OCC is for the
other half of the taxonomy: exchange between individuals (product, service),
gifts, lending between people who already know each other, and the Cat paying
for things on a user's behalf. Two rails, one asset, and the user chooses which
memory to leave behind.

"Transparent where chosen" is concrete at every stage. In Stage 1 the payer can
hand over a spent note's secret and DLEQ proof and anyone can verify the mint
signed it. In Stage 3 a viewing key discloses one address's history, and a
payment disclosure proves one payment, to one auditor, without opening the rest.

## Consequences

- No schema, no API and no UI change follows from this ADR. It is a direction.
- `public-content.ts` and the fund-to-build non-goals are still true and stay
  as written until Stage 1 ships behind a flag.
- The denomination rule holds: OCC balances are BTC in `NUMERIC(18,8)`, shown
  through `useDisplayCurrency`. Sats appear only at the Lightning boundary, as
  everywhere else. There is no "OCC" unit and no exchange rate to BTC, because
  there is nothing to exchange.
- The name is a brand for the shielded rail. Calling it a coin in marketing is
  fine; calling it a coin in code or a data model is not, because it would
  imply a second asset.
- Quantum: ecash blind signatures, Orchard and FCMP++ all rest on the discrete
  logarithm problem, as does Bitcoin itself. OCC inherits Bitcoin's migration
  timeline and adds no new exposure the base layer does not already have.

## Open questions before Stage 1 starts

1. Legal: what is a Swiss-operated ecash mint with EU users, under FINMA and
   MiCA? Custody, e-money and travel-rule questions, in writing, before code.
2. Which mint implementation: Nutshell (reference, Python), cdk (Rust), or run
   against a public mint first and only self-host when there is real volume.
3. Float policy: the per-user soft cap, the nudge-to-melt threshold, and what
   proof of liabilities the platform commits to publishing and how often.
4. Whether the Cat's purse is per user (NIP-60 keys the user holds) or a
   platform-held purse the Cat spends from. The former is the principled
   answer and the harder one.

## Next step

A Solon proposal, not a pull request: Stage 1 as described, with the legal memo
attached, so the people who will be the Stage 2 guardians are the ones who
approve the custody exception in the first place.
