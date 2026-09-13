/**
 * Public product changelog — SSOT.
 *
 * A curated, human-readable record of what shipped, newest first. Rendered at
 * the public `/changelog` route (no login required). Keep entries user-facing:
 * describe the change from the reader's side, not the commit. Every entry here
 * corresponds to work that actually shipped to production.
 */

export type ChangelogTag = 'feature' | 'improvement' | 'fix' | 'platform';

export interface ChangelogEntry {
  /** ISO date the change shipped (YYYY-MM-DD). */
  date: string;
  tag: ChangelogTag;
  title: string;
  summary: string;
  /** Optional detail bullets. */
  items?: string[];
}

/** Display metadata for each tag (label + which token drives its chip). */
export const CHANGELOG_TAGS: Record<ChangelogTag, { label: string }> = {
  feature: { label: 'New' },
  improvement: { label: 'Improved' },
  fix: { label: 'Fixed' },
  platform: { label: 'Platform' },
};

/** Newest first. */
export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-07-31',
    tag: 'feature',
    title: 'Spending caps for Cat, and payments any machine can make',
    summary:
      'Two guardrails-and-rails updates: hard Bitcoin spending limits on Cat payment actions, and a documented API loop so any agent or script can discover, buy, and verify settlement.',
    items: [
      'Set a max-per-payment cap and a daily Bitcoin budget in Cat → Permissions; Cat cannot exceed them even after you confirm.',
      'New public API endpoints: create a payment for any public listing and poll it until it settles — with an integration key or no account at all.',
      'The full machine-buying walkthrough is in the live API spec at /api/v1/openapi.json.',
    ],
  },
  {
    date: '2026-07-29',
    tag: 'feature',
    title: 'Your Cat learns from real outcomes',
    summary:
      'Cat now sees what actually happened to what you created together — published, funded, settled — and grounds its advice in those outcomes instead of guesses.',
    items: [
      'New Track Record in the Cat hub’s Context tab: created → published → funded, with settled Bitcoin per entity.',
      'The same record is part of Cat’s own context, so suggestions lean on what worked for you.',
      'Fixed: actions that asked for your confirmation could fail outright; confirmations now work.',
    ],
  },
  {
    date: '2026-07-22',
    tag: 'feature',
    title: 'Discover, sharper and searchable',
    summary:
      'Find what matters by meaning, not just keywords — and let search engines find it too.',
    items: [
      'Public semantic search across the economy: projects, people, and offers, matched by intent.',
      'Discover now server-renders a crawlable content strip, so published work is indexable and shareable.',
    ],
  },
  {
    date: '2026-07-21',
    tag: 'feature',
    title: 'A two-sided market',
    summary:
      'The platform now indexes what people want, not only what they offer — and introduces the two sides.',
    items: [
      'A public open-demand feed: browse what the community is looking for.',
      'Two-sided introductions surface matches between demand and supply.',
    ],
  },
  {
    date: '2026-07-21',
    tag: 'feature',
    title: 'Support in Bitcoin',
    summary:
      'A Bitcoin-native Supporter checkout — back the platform directly, settled on Lightning or on-chain.',
  },
  {
    date: '2026-07-19',
    tag: 'platform',
    title: 'Wired to Loki',
    summary: 'OrangeCat is the economic layer for Loki — and now the wiring runs both ways.',
    items: [
      'Settled funding on a project or cause signals the Loki fleet automatically.',
      'Embedded the Loki feedback widget — OrangeCat runs as its own second customer.',
    ],
  },
  {
    date: '2026-07-14',
    tag: 'improvement',
    title: 'Cat Credits go-live plumbing + steadier sessions',
    summary:
      'Groundwork for paid Cat Credits, and a fix so auth-gated pages resolve instead of spinning.',
    items: [
      'Cat Credits go-live is now environment-driven, with a wallet-verification step.',
      'Closed a hydration gap that could pin logged-in pages on a loading spinner.',
    ],
  },
  {
    date: '2026-07-13',
    tag: 'feature',
    title: 'Cat-first, and payable on publish',
    summary:
      'Your Cat is the front door, and publishing something payable is a guided, one-link step.',
    items: [
      'The dashboard routes everyone to the Cat hub.',
      'Publishing a payable entity nudges you to connect a wallet and hands you a payable public link.',
      'Hardened a public-profile data-exposure path.',
    ],
  },
  {
    date: '2026-07-09',
    tag: 'feature',
    title: 'Peer-to-peer Bitcoin loans',
    summary:
      'Lend and borrow directly: offers, obligations, and payment handoffs — no bank in the middle.',
  },
  {
    date: '2026-07-08',
    tag: 'improvement',
    title: 'Funding transparency you control',
    summary:
      'Per-entity controls over how much of your funding picture is public — transparency by choice.',
  },
  {
    date: '2026-06-17',
    tag: 'platform',
    title: 'Log in with OrangeCat',
    summary:
      'OrangeCat became an OpenID Connect provider — one identity you can carry across the ecosystem.',
  },
  {
    date: '2026-06-12',
    tag: 'platform',
    title: 'Self-hosted and sovereign',
    summary:
      'Moved to fully self-hosted infrastructure — the platform runs on hardware we control.',
  },
];
