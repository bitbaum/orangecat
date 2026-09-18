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
    date: '2026-09-17',
    tag: 'feature',
    title: 'Dates read the way you read them',
    summary:
      'OrangeCat wrote every date the American way \u2014 March 15, 2027 \u2014 regardless of where you are. Date format is now a setting, and left alone it follows the country on your profile.',
    items: [
      'Settings \u2192 Date Format offers day first (15 Mar 2027), month first (Mar 15, 2027) or year first (2027-03-15).',
      'Left on automatic it is inferred from your country, then your currency \u2014 so moving country changes your dates without you touching anything.',
      'Most of the world, and most of this platform, writes the day first. Signed-out pages now do too.',
    ],
  },
  {
    date: '2026-09-17',
    tag: 'feature',
    title: 'Every wallet has a page of its own',
    summary:
      'A wallet used to exist only as a card inside somebody\u2019s profile. It now has its own address you can send someone \u2014 and the on-chain numbers behind it were corrected.',
    items: [
      'orangecat.ch/wallets/<id> shows a wallet\u2019s label, category, owner and payment handle, with a QR code.',
      'Balances and transaction history now scan both of a wallet\u2019s derivation chains. Scanning only one under-reported any wallet that had ever spent, and made outgoing payments look larger than they were.',
      'A wallet that does not exist answers 404 rather than a page saying it does not exist.',
    ],
  },
  {
    date: '2026-09-15',
    tag: 'fix',
    title: 'Balances say when they were last checked',
    summary:
      'A number nobody has read is no longer displayed as zero. Projects showed \u201cBitcoin Balance CHF 0.00\u201d whether or not anyone had ever asked the blockchain.',
    items: [
      'A project\u2019s Bitcoin balance reads \u201cNot checked yet\u201d until it has actually been read.',
      'The Wallets tab is visible on a profile instead of hidden in the overflow menu \u2014 it answers \u201chow do I pay this person?\u201d.',
      'Fixed wallets that all claimed to be the primary one, which made \u201cthe primary wallet\u201d resolve to a deleted row.',
    ],
  },
  {
    date: '2026-09-14',
    tag: 'feature',
    title: 'AI assistants are now Companions, and they remember you',
    summary:
      'A companion\u2019s memory belongs to the person talking to it, not to whoever created it \u2014 and the owner can no longer read other people\u2019s conversations.',
    items: [
      'The conversation is the page: talking to a companion is the main surface, not a tab.',
      'Cloning a companion copies its definition and none of its memories.',
    ],
  },
  {
    date: '2026-09-14',
    tag: 'platform',
    title: 'Free AI that actually answers',
    summary:
      'The free model chain had never worked end to end. It now has three genuinely free providers, ordered so the scarcest runs out last.',
    items: [
      'Gemini added as a third free provider, verified with a real key rather than a claim.',
      'Providers are drained in order of capacity, so the smallest quota is not spent first.',
      'An empty response is treated as a failed provider rather than a finished answer.',
      'Cat says so when the last free provider is exhausted, instead of going quiet.',
    ],
  },
  {
    date: '2026-09-12',
    tag: 'fix',
    title: 'Six public tables had row-level security switched off',
    summary:
      'Six tables readable with the public key had no row-level security enabled. Now they do.',
  },
  {
    date: '2026-09-11',
    tag: 'feature',
    title: 'Cat can read the web, and has to cite it',
    summary:
      'Cat can search and read pages, and every claim drawn from one carries a link the reader can follow and check.',
    items: [
      'Cat can commission a real, deployed website through Loki.',
      'A project published through the API can be taken back down again.',
    ],
  },
  {
    date: '2026-09-10',
    tag: 'feature',
    title: 'Set a page up for someone else',
    summary:
      'You can create a profile or project on behalf of someone who has no account, and hand it over in one transaction. Until they claim it, it is visible and clearly theirs.',
    items: [
      'A free @orangecat.ch address is the default, and buying a custom domain is one step.',
      'Cat asks for permission by name before acting, and one consent card covers identical requests.',
    ],
  },
  {
    date: '2026-09-08',
    tag: 'feature',
    title: 'Wallets show what they actually received and sent',
    summary:
      'On-chain history on the wallet card, with the net movement for that wallet rather than the transaction\u2019s total.',
    items: [
      'Every extended-key wallet used to report exactly 0 BTC, because the endpoint the code called had never existed. It now derives addresses and scans them.',
      '\u201cWe could not read the chain\u201d is shown as a failure with a retry, never as an empty list.',
    ],
  },
  {
    date: '2026-09-07',
    tag: 'fix',
    title: 'Payments stopped being sent to wallets that cannot receive',
    summary:
      'New users were routed to a wallet with no way to accept money, and a send-only wallet connection took the whole receiving path down with it.',
    items: [
      '\u201cLooks good\u201d on a wallet now means \u201ccan be paid\u201d \u2014 a real probe, not a shape check.',
      'The sign-in round trip was broken in three places and is fixed.',
      '/api/health/ai exists, because the Cat\u2019s provider chain had died twice without anyone noticing.',
    ],
  },
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
