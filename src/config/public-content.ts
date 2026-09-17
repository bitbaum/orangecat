import { CAT_FRONTIER_MODELS_LIST } from './cat-plans';

/**
 * The "where this is going" paragraph shared by /pricing and /support —
 * previously duplicated verbatim on both pages. Split around the emphasized
 * word so the pages can render <strong>{emphasis}</strong> without owning
 * divergent copies of the copy.
 */
export const PRO_DESTINATION_COPY = {
  before: 'The destination is ',
  emphasis: 'Pro',
  after: `: frontier models — ${CAT_FRONTIER_MODELS_LIST} — fully managed by OrangeCat, no keys, no setup. The kind of effortless AI a serious company runs on.`,
} as const;

export const CURRENT_CAPABILITIES = [
  'Public pages for people, projects, groups, products, services, events, and other entities.',
  'Non-custodial Bitcoin payments through Lightning, Lightning Address, NWC, and on-chain addresses.',
  'Public project funding records based on confirmed Bitcoin settlement.',
  'Human-approved Cat actions and an identity bridge to Loki.',
] as const;

export const ROADMAP_PHASES = [
  {
    marker: 'NOW',
    title: 'Share and fund anything',
    summary:
      'Make every eligible public entity easy to share and support in Bitcoin, including for people without an OrangeCat account.',
    items: [
      'One clear “Support with Bitcoin” action alongside buying, booking, or joining.',
      'Tracked public payment requests with confirmed amounts attributed to the correct entity.',
      'Consistent share controls and link previews across public entity pages.',
      'Open accounting: a wallet can publish its balance, its transactions, and the owner\u2019s note on each one \u2014 for owners who turn it on.',
      'A transparency score computed from what is observable in that ledger, never from what anyone claims about themselves.',
      'No fiat, privacy-coin, or smart-contract controls presented as if they work today.',
    ],
  },
  {
    marker: 'NEXT',
    title: 'Fund-to-build',
    summary:
      'Connect OrangeCat entities to Loki projects without forcing people to understand two internal systems.',
    items: [
      'Send any actionable OrangeCat entity to Loki with a signed, owner-approved handoff.',
      'Link a Loki project back to its public OrangeCat funding and promotion page.',
      'Let Loki propose a practical plan while the owner chooses what agents may execute.',
      'Show a read-only Bitcoin funding summary inside the linked Loki project.',
    ],
  },
  {
    marker: 'LATER',
    title: 'More rails and deeper coordination',
    summary: 'Broaden only after the Bitcoin fund-to-build loop works reliably for ordinary users.',
    items: [
      'Fiat rails such as Twint require bank, identity, reconciliation, and custody decisions. They are not available now.',
      'Privacy coins improve confidentiality but cannot provide the same public funding audit trail. They are not available now.',
      'Smart contracts may support escrow and milestone releases after disputes and oracle boundaries are designed.',
      'Full Nostr identity, relay federation, and automatic funding-driven dispatch remain research, not current product claims.',
    ],
  },
] as const;

export const WHITEPAPER_SECTIONS = [
  {
    title: 'Three pillars, one stack',
    paragraphs: [
      'OrangeCat is the public economic layer: the place where an entity is explained, shared, supported, offered, or joined. Loki is the production layer: the place where Loki plans work and supervised agents help turn the entity into something real. Solon is the governance layer: the place where platform-level rules are proposed, voted on with Bitcoin-signed messages, and published as decision documents anyone can re-verify.',
      'They remain separate products because public economic coordination, local agent execution, and rule-making have different security boundaries. They should nevertheless feel like one journey: fund what is being built, build what people choose to fund, and govern both in the open.',
      'The governance tie is enforced, not aspirational: OrangeCat’s platform allocation policy — the ceiling on what the Cat may spend — changes only via a Solon vote, and OrangeCat re-verifies every vote signature against its own pinned keys before honoring a decision. A Solon decision is evidence, not authority.',
    ],
  },
  {
    title: 'Bitcoin first',
    paragraphs: [
      'The first settlement rail is Bitcoin. Lightning gives ordinary users fast, inexpensive payments; on-chain Bitcoin supports larger or slower transfers. Both are non-custodial and can be independently verified.',
      'Fiat is visible to banks but does not give the public a shared ledger. Privacy coins intentionally hide transfers from public view. Both may become useful later, but neither belongs in the first auditable fund-to-build loop.',
    ],
  },
  {
    title: 'Entities before special cases',
    paragraphs: [
      'A person, project, club, cause, product, service, or event is an entity with a public story, an owner, links, and optional Bitcoin support. The system should not need a special workflow for every kind of ambition.',
      'When someone creates a club, for example, OrangeCat can suggest taking it to Loki. Loki can propose a business plan, financial model, location research, permits research, a website, staffing, and launch communications. The owner approves the plan and controls every real-world action.',
    ],
  },
  {
    title: 'Accountability without premature automation',
    paragraphs: [
      'Confirmed Bitcoin contributes to the public ledger. Signed handoffs bind an OrangeCat entity to the owner who sends it to Loki. Typed links preserve where a project came from and where it can be funded.',
      'Funding does not automatically unleash agents. Settlement, project planning, and agent execution are separate events with explicit approval boundaries. This makes the first version understandable and reversible while leaving room for later escrow or milestone contracts.',
    ],
  },
] as const;
