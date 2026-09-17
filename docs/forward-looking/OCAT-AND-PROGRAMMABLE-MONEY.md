# ocat, a coin, and smart contracts — what has been considered

**Status:** strategy notes. Nothing here is built, promised, or announced.
**Last updated:** 2026-09-17

Deliberately not a blog post. A public page saying "we may launch a coin" is a
commitment to the reader whether or not it is phrased as a maybe, and it invites
exactly the audience a funding platform does not want first. The thinking is
worth recording; publishing it is a separate decision.

---

## The names

Checked against the registries on **2026-09-17** (RDAP, not a reseller's search
box — a reseller has an incentive to tell you a name is taken):

| Name | Registry answer | Reading |
| --- | --- | --- |
| `ocat.ch` | RDAP 404 | **unregistered** |
| `orangecatcoin.com` | RDAP 404 | **unregistered** |
| `ocat.com` | RDAP 200 | taken (GoDaddy nameservers, parked) |

`.ch` is a few francs a year and `ocat.ch` is a genuinely good short form of a
name already in use. Registering it defensively is cheap and reversible, and it
costs nothing to hold while the rest of this is undecided. **That is a purchase,
so it is George's to make** — no agent should be buying domains.

`orangecatcoin.com` is a different kind of decision. Holding it is also cheap,
but the name makes a claim the product does not currently make, and a registered
domain gets found. See below.

---

## "A coin" is three different products

The word covers three things that share no engineering and no risk profile.

**1. A unit of account.** OrangeCat already has one: Bitcoin. Prices are stored
in BTC (`NUMERIC(18,8)`) and displayed in the user's chosen currency. Nothing is
missing here, and a second unit would be a second source of truth for the same
fact — the failure this codebase spends most of its effort avoiding.

**2. A loyalty or credit balance.** Cat credits already exist, bought with
Bitcoin, spent on inference. That is a closed-loop balance, not a token: it is
not transferable, not tradeable, and has no price. Extending it is a product
question, not a monetary one, and it stays boring on purpose.

**3. A transferable token with a market price.** This is the one the name
implies, and the only one that changes what OrangeCat legally is. In Switzerland
that lands under FINMA's token categories, and which category decides whether it
is a payment instrument, a utility, or a security — with different consequences
for each. **This needs a lawyer, not a judgement call from an engineer or an
agent.** Nothing in this repository should move toward issuance before that
conversation has happened.

The honest summary: (1) is done, (2) exists and can grow, (3) is a company-level
decision with legal prerequisites, not a feature.

---

## Smart contracts, and why they come after open accounting

The useful version is narrow and concrete: escrow that releases on a condition,
milestone release for project funding, recurring commitments that do not depend
on someone remembering. All three are things OrangeCat's entity taxonomy already
describes (`project` carries milestone accountability; `loan` expects repayment;
`investment` expects a return) and currently enforces socially rather than
cryptographically.

The sequencing argument is simple. **A contract that releases funds on a
milestone is only as trustworthy as the ledger everyone reads to decide whether
the milestone happened.** Until a wallet can publish what it holds and what
moved — and until those numbers are demonstrably true — programmable release is
automating a number nobody can check.

On Bitcoin specifically, the realistic primitives are multisig, timelocks and
Lightning-native constructions, not a general-purpose contract VM. That is a
narrower design space than "smart contracts" usually implies, and narrower is
good: each of the three use cases above fits inside it.

---

## What to do next, in order

1. **Register `ocat.ch`** if the short name is wanted. Cheap, reversible,
   forecloses nothing. (George — it is a purchase.)
2. **Finish open accounting and the observed transparency score.** Everything
   below depends on the ledger being true and readable.
3. **Leave `orangecatcoin.com` alone until (3) above has a legal answer.**
   Registering it is harmless; building toward it is not.
4. **Prototype escrow as multisig + timelock** against a real project with open
   accounting on, once there is one. A demonstration on a checkable ledger is
   worth more than a design document.
