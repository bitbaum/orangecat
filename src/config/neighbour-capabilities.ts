/**
 * WHAT THE NEIGHBOUR PRODUCTS CAN DO — the only place OrangeCat says it.
 *
 * Cat once told a user "Solon can set up the governance" for their project.
 * It was not hallucinating in the usual sense: `solon` appeared NOWHERE in its
 * brief, so it did the only thing left and guessed from the name. It happened
 * to guess close, which is worse than guessing wrong — a lucky guess reads as
 * knowledge and nobody checks it.
 *
 * Loki solved this in its own repo first: `src/config/ecosystem.ts` →
 * `ORANGECAT_CAPABILITIES`, read verbatim into its prompt, never restated in
 * prose anywhere else. This is the same idea pointing the other way.
 *
 * ── Every claim carries its source ──────────────────────────────────────────
 * `source` is not decoration and it is not a citation for the reader. It is
 * the thing that makes "never claim what a project cannot back" checkable
 * instead of aspirational: a line nobody can source is a line nobody may add,
 * and `neighbour-capabilities.test.ts` fails the build on an empty one.
 *
 * The source must be a PRODUCER — the neighbour's own repo stating its own
 * capability — never this file's opinion of what they probably do. If you
 * cannot point at where the neighbour says it about itself, it does not go in.
 *
 * ── What does NOT go here ───────────────────────────────────────────────────
 * Roadmaps, intentions, and "will soon". Cat reads this to decide what to
 * offer a person today; a capability that does not exist yet becomes a promise
 * made to someone who then waits for it.
 */

import { ECOSYSTEM } from '@/config/ecosystem';

export interface NeighbourClaim {
  /** One sentence, in plain terms, about what the neighbour does. */
  says: string;
  /** Where that neighbour says it about ITSELF. A producer, never a guess. */
  source: string;
}

export interface Neighbour {
  title: string;
  /** One line: what this product IS, before any capability. */
  what: string;
  can: readonly NeighbourClaim[];
  /** Things it explicitly does NOT do — the half that stops overselling. */
  cannot: readonly NeighbourClaim[];
}

export const NEIGHBOURS = {
  loki: {
    title: 'Loki',
    what: 'the engineering plane — it builds and ships software with AI agents',
    can: [
      {
        says: 'take a brief and produce a repository, a deployed result, and a feedback form the owner steers changes through',
        source:
          'bitbaum/loki AGENTS.md — "brief → repository → deployed result → feedback → verified change"',
      },
      {
        says: 'be handed a project straight from this chat, with no account or technical skill needed from the owner',
        source: 'this repo — the send_to_loki action',
      },
    ],
    cannot: [
      {
        says: "make video, music or prose — that is OrangeCat's own Studio, not Loki",
        source:
          'bitbaum/loki AGENTS.md — "Loki builds software. It does not make video, music or prose."',
      },
      {
        says: 'promise a delivery date',
        source: 'no producer states one, so neither may we',
      },
    ],
  },
  solon: {
    title: 'Solon',
    what: 'the governance plane — proposals, Bitcoin-signed votes, versioned policies, an append-only audit trail',
    can: [
      {
        says: 'hold a decision as a proposal and settle it by Bitcoin-signed vote, with the result recorded as a versioned policy',
        source:
          'bitbaum/solon AGENTS.md — "proposals, Bitcoin-signed votes, versioned policies, append-only audit"',
      },
      {
        says: 'change the ceiling on what the Cat may spend platform-wide — the only wire between the two products today',
        source:
          'this repo — src/config/solon.ts and src/services/solon/ re-verify the signed decision locally',
      },
    ],
    cannot: [
      {
        says: "hold or move anyone's money — its treasury is watch-only, it stores addresses to observe and never holds keys or funds",
        source: 'bitbaum/solon AGENTS.md — "The treasury is watch-only"',
      },
      {
        says: 'be worth setting up for a single person or a first contact — it is real for a Verein, a co-op, a group deciding together',
        source: 'bitbaum/orangecat ADR-0003 amendment — "narrower still ... absurd for a bakery"',
      },
    ],
  },
} as const satisfies Record<string, Neighbour>;

/**
 * A link that carries the question across, instead of dropping someone on a
 * home page to start again.
 *
 * Retyping is where a handoff is lost. Cat already receives one of these
 * (`/dashboard/cat?q=`), and Loki accepts `?name=&brief=` on its
 * new-project form (bitbaum/loki#778), so this is the sending half.
 *
 * Both sides PREFILL ONLY — nothing is created and nothing is sent by
 * following one of these. A link that acted on someone's behalf would be a
 * different and much worse thing.
 *
 * Solon is absent on purpose. It has no agent surface and no brief to prefill,
 * so there is nothing here to hand a question to; a "talk to Solon" link would
 * point at a page that cannot answer. When that changes, it goes here.
 */
export function lokiBuildHandoff(brief: string, name?: string): string {
  const url = new URL('/control/new-from-scratch', ECOSYSTEM.loki.siteUrl);
  // Same cap the receiver applies. Sending more than the other side accepts
  // produces a silently truncated brief, which reads as Loki losing the plot.
  url.searchParams.set('brief', brief.trim().slice(0, 2000));
  if (name?.trim()) {
    url.searchParams.set('name', name.trim().slice(0, 100));
  }
  return url.toString();
}

export type NeighbourKey = keyof typeof NEIGHBOURS;

/**
 * The block Cat's brief carries verbatim. Built, not written twice: the prompt
 * used to hardcode a paragraph about Solon in prose, which is the same copy
 * problem this file exists to end.
 */
export function neighbourCapabilityBrief(): string {
  return Object.values(NEIGHBOURS)
    .map(n => {
      const can = n.can.map(c => `  - it can ${c.says}`).join('\n');
      const cannot = n.cannot.map(c => `  - it CANNOT ${c.says}`).join('\n');
      return `**${n.title}** — ${n.what}.\n${can}\n${cannot}`;
    })
    .join('\n\n');
}
