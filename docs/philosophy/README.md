# Philosophy

**What this is**: the single source of truth for why the three products exist and how every
product and engineering decision across them is derived. OrangeCat (economy), Loki (engineering)
and Solon (governance) share it. Each repo's CLAUDE.md points here rather than restating it.

**How it evolves**: it is built on, not rewritten. The founder thinks out loud in sessions; the
agent distills, cross-checks against what the code actually does, and appends. Ideas that are
worth publishing go to `post-seeds.md` in this folder. When a claim here stops matching the code,
fix the claim or fix the code, but never leave them disagreeing.

**Last built on**: 2026-09-14

---

## 1. What we are

We are first-principles problem solvers. The method is a loop: identify a problem, design a
solution from first principles, execute until the problem is actually solved, then find the next
one. Systems design sits at the core of every step. We do not do things we do not believe in.

We are techno-optimists in a precise sense: every constraint imposed on a person from outside is
an engineering problem, and engineering problems get solved.

We are anarcho-capitalists in a precise sense, stated in section 2. It is narrower than "no
rules" and it is what the code builds.

## 2. The consent principle

**No rule binds you that you did not consent to, and every rule you did consent to is verifiable
by you.**

This is not a slogan. It is enforced in code:

| Where                                               | What it enforces                                                                                                                                                        |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Solon, signed votes                                 | A decision is evidence, not authority. OrangeCat re-verifies every Bitcoin vote signature against its own pinned keys before honoring it. Anyone can recount the tally. |
| Solon, watch-only treasury                          | Governance describes money and never holds it. There is no code path that can spend.                                                                                    |
| Solon, append-only audit                            | History cannot be rewritten by whoever holds the admin key today.                                                                                                       |
| Solon, `src/lib/config/governance.ts`               | Four categories are humans-only: aid disbursement, membership, safety, and the governance rules themselves. Agents can never vote to expand their own suffrage.         |
| OrangeCat, `src/services/cat/model-access.ts`       | What the model picker offers is derived from real state. A model you cannot reach shows as locked with the reason. No fake-enabled row silently substitutes.            |
| OrangeCat, `src/services/cat/permission-service.ts` | The Cat's spending ceiling is a Solon policy. The agent operates inside limits humans chose and can verify.                                                             |

The humans-only categories look like a contradiction of "any identity, human, pseudonymous or AI,
is a full economic participant." They are not. Full economic participation means an agent can
earn, hold, spend and propose. Governance membership is a separate contract with its own terms,
and a group of humans forming a DAO may set those terms as they choose. Constraints are not bad.
Constraints must be chosen, visible, and enforced by verification instead of trust.

The entity taxonomy is the same principle applied to money. Gift, project, loan, investment is a
gradient of strings, from none to many. The platform does not pick a point on that gradient for
you. It makes every point available and makes the terms of each explicit. Freedom of the full
spectrum, not freedom from obligations.

## 3. Ungovernable technology

A system is governable to the extent that it has chokepoints: places where one party can
withhold something everyone else depends on. Ungovernable technology is any technology that
removes a chokepoint. It does not fight the gatekeeper. It makes the gate irrelevant.

The three products are an inventory of chokepoints and the technology that removes each:

| Chokepoint                                     | Removed by                                                    | In the stack                                                          |
| ---------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------- |
| Labor: dependence on employment to live        | AI and robotics                                               | The Cat, and Loki's agent fleet                                       |
| Money: control over the transfer of value      | Bitcoin and Lightning; a private layer (section 6)            | OrangeCat wallets, payments, any-currency payment methods             |
| Institutions: trust in whoever holds the count | Bitcoin-signed votes, append-only record, watch-only treasury | Solon                                                                 |
| Compute: permissioned access to models         | Bring-your-own-key, local models, open weights                | OrangeCat model access; the picker never lies about what it can serve |
| Identity: the real-name requirement            | Pseudonymity by default, keys as identity                     | OrangeCat actors; Solon members sign with their own keys              |
| Speech: a server that can read or block you    | End-to-end encryption, Nostr                                  | Roadmap. Messages are plaintext today. Do not claim otherwise.        |

Every feature belongs in one of these rows or it does not belong in the stack.

### Work and craft

Work is any activity you would not do as a matter of free will. You would not do it for free. AI
and robotics remove the necessity of work: they take the activities people do only because they
must. That is the labor chokepoint, and it is the largest one, because a person who must work is
governable through their employer, their bank, and their landlord all at once.

Removing work does not remove effort. People still climb, build, compose, and ship things they
were never paid for. That is craft, chosen effort, and it is what remains when the necessity is
gone. The stack exists to shrink work and leave room for craft.

## 4. What technology cannot solve

Happiness is not a problem in the engineering sense. It is a signal, and a signal only carries
information when it varies. People return toward a baseline after both windfalls and disasters;
that is hedonic adaptation, and it is why happiness is relative in practice. A reading that never
moves is not telling you the room is perfect. It is telling you the sensor is broken.

Take the absolute version seriously. An agent held at maximum reward forever has no gradient.
Nothing it could do would improve its state, so it has no reason to do anything. It cannot learn,
choose, or act. Eternal suffering fails identically from the other side: a gradient that never
closes carries no information either. Both are dead systems. They are the same failure.

Sehnsucht, longing for something absent that is painful and sweet at once, is the felt
experience of a gradient. It is the distance between the state you are in and the state you
want. It is exactly what a first-principles problem solver runs on. The loop in section 1 is
Sehnsucht made into a method.

**Technology should remove every constraint you did not consent to. It should never remove the
gap between where you are and where you want to be, because that gap is the engine.** A platform
whose users became permanently satisfied would be a platform whose users stopped building,
funding, and governing. The Cat's job is to make the next problem reachable, not to make
problems disappear.

## 5. The scale of things

Human life is short against the horizon that matters: consciousness outlasting biology, then the
planet, then the star, then whatever is beyond the universe. Against that horizon, the problems
of the next century are small.

Small is not zero. A civilization that does not make it through the next two hundred years never
reaches the trillion-year problems. The long horizon does not say ignore the near term. It says
order the near term by whether it keeps the long option open. Survival first, then freedom, then
preservation of consciousness. The products are near-term work that funds and enables the long
project, and they are judged by that.

## 6. Privacy: transparent and private are both first-class

Bitcoin gives a public, immutable ledger. That is the right default for anything a person chooses
to make verifiable: a project's funding, a DAO's treasury, a vote. It is the wrong default for
everything else, and OrangeCat's fifth principle already says so: private where needed,
transparent where chosen.

The private layer is roadmap. Before designing it, the first-principles facts:

- **Privacy comes from the anonymity set, not from the cryptography.** A perfect protocol with a
  hundred users hides you among a hundred people. Zcash's optional shielded pool stayed small for
  years for this reason. Monero's privacy is mandatory, so the whole chain is the set.
- **Mimblewimble is a protocol, and the coins built on it mostly died.** Grin and Beam both
  launched in January 2019. Grin survives with low activity; Beam pivoted. The idea survived as
  Litecoin's MWEB, an opt-in extension block, live since 2022 and again with a small set.
- **A new coin starts with an anonymity set of zero.** Its privacy is weak on day one no matter
  how good the protocol is, and it only improves if it wins users away from chains that already
  have them.

The consequence for the roadmap: privacy must be the default, never a checkbox, or the set never
grows. And the honest sequence is to ship the private layer on top of the Bitcoin users we
already reach before minting a chain. Ecash on Lightning, blind-signed tokens from a mint, gives
strong payer privacy and slots into the existing wallet stack; its cost is trusting the mint with
custody, which is a real cost and must be stated. A sovereign private chain is the right answer
only if that cost proves unacceptable, and that is a decision to make on evidence, not on
enthusiasm for a protocol.

## 7. Mystery

The work is public. The person is private. That is pseudonymity by default applied to ourselves.

Building loudly under a real name buys attention and costs peace of mind, and the cost is
permanent. Building under the product names, with the founder as one more pseudonymous actor on
the platform, keeps the attention on the thing that should carry it. Do the same work as the
loud builders, with less of the voice.

This also decides how the writing gets published. Posts go out under the product or under a
pseudonym, never under the founder's legal identity, and never with details that reconstruct it.

## 8. The decision rule

Every feature in the three products is tested against three questions, in order:

1. **Does it remove an imposed constraint or add a chosen one?** Removing a gatekeeper passes.
   Adding a rule passes only if the people bound by it opted in and can verify its enforcement.
   Adding a rule for someone's own good, without their consent, fails.
2. **Does it replace trust with verification?** Signed votes, published records, watch-only
   treasuries, derived model availability all pass. A number the user must believe because the
   platform says so fails, however convenient.
3. **Does it preserve the user's gradient?** A feature that makes the next goal reachable passes.
   A feature whose success condition is that the user stops wanting anything fails. This is the
   question an engineer optimizing engagement would violate first.

The first two are enforced in code today. The third is not enforced anywhere yet. It is written
down so that it can be.

## 9. Naming

"Ungovernable technology" is the concept. The name of any public-facing home for it matters less
than the concept and is open. Domain snapshot from Swiss RDAP on 2026-09-14: `ungov.ch` and
`ungoverned.ch` were unregistered; `ungovernable.ch` and `angov.ch` were taken. A snapshot, not
a reservation.
