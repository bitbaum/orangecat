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
    date: '2026-09-24',
    tag: 'feature',
    title: 'Point at what you don\u2019t like, and have it changed',
    summary:
      'Drafts the Cat writes for you now carry a \u201cChange this\u201d control. Tap it, say how you want it to work, and choose what should happen next: Loki changes it for you, or shows you how to get where you were going.',
    items: [
      'The draft you were reading is already selected, so you do not have to go and find it again.',
      '\u201cShow me how\u201d is for when the thing you want probably exists and you could not find it. The answer also makes that path easier to find for the next person.',
      'The feedback button on every page offers the same two choices.',
    ],
  },
  {
    date: '2026-09-20',
    tag: 'fix',
    title: 'Cat keeps its footing when the free tier runs short',
    summary:
      "When Cat's instructions do not fit the free tier, some are trimmed. Two of the ones it trimmed early were the ones telling it how to answer someone having a hard time. Those are now the last things it will ever give up.",
    items: [
      'If you write to Cat about a difficult situation, it no longer risks answering with a business strategy because it was short on room that minute.',
      'Three newer parts of its instructions were being kept no matter what, purely because nobody had classified them \u2014 they were taking up room that your own information should have had.',
      'A check now fails the build if any part of Cat\u2019s instructions is left unclassified, so this cannot happen quietly again.',
    ],
  },
  {
    date: '2026-09-20',
    tag: 'improvement',
    title: 'Cat keeps more of your conversation',
    summary:
      "Cat's instructions are larger than the free tier allows in one go, so some are trimmed on every message. It was trimming your conversation before the generic advice. Now it is the other way round.",
    items: [
      'What Cat knows about you \u2014 your listings, your history \u2014 is now the last thing given up, not the second.',
      'When it does have to shorten what it knows about you, it now keeps as much as the free tier has room for. It was throwing all of it away over a handful of tokens.',
      'On an ordinary message this keeps a turn of conversation that used to be discarded.',
      'Fixed a diagnostic that reported your context as discarded when it was present, which is the kind of thing that sends whoever is debugging at the wrong problem.',
    ],
  },
  {
    date: '2026-09-20',
    tag: 'platform',
    title: 'Prices are real; the checkout is deliberately shut',
    summary:
      'You can now read exactly what Cat costs on every route. You cannot pay us yet, on purpose: OrangeCat is not a registered company, so it must not take money. Paying other people was never affected.',
    items: [
      'One switch now decides whether OrangeCat may charge at all, it is off unless explicitly turned on, and every path that takes money for OrangeCat refuses behind it on the server.',
      'Before this, the only thing in the way was whether a receiving wallet happened to be configured \u2014 an infrastructure setting standing in for a legal decision, which would have opened the till as a side effect of testing.',
      'An invoice already paid still credits. Shutting a till must never strand money somebody already sent.',
      'Reaching the top-up screen now explains why it is shut and what still works, instead of showing a disabled button labelled \u201csoon\u201d.',
      'Paying other people on OrangeCat is untouched and always will be \u2014 that money goes directly to them at 0% fees and never passes through us.',
    ],
  },
  {
    date: '2026-09-20',
    tag: 'feature',
    title: 'Bring a Claude key straight to Cat',
    summary:
      'Anthropic is now wired directly, so a Claude key works on its own instead of having to go through OpenRouter. Getting a key from any provider is one click. And there is finally one page explaining what actually powers Cat.',
    items: [
      'Anthropic joins Groq, OpenRouter, OpenAI, Together AI, xAI and DeepSeek as a direct provider — paste your key and Cat uses it.',
      'Choosing a provider now shows a button straight to that provider\u2019s own key page, naming where it sends you, instead of four words of grey text under the password box.',
      '\u201cHow Cat runs\u201d explains the four ways to power Cat \u2014 free pool, credits, your own key, your own machine \u2014 with what each costs, where your words go, and what each is bad at. Local models are genuinely weak at taking actions, and it says so.',
      'Memory moved to its own settings tab. What Cat remembers about you is not a billing setting and should not be buried under one.',
      'Cat Credits stated two different prices on two adjacent screens. Both now read from one source.',
      'Image generation was described as free; it does not use your daily messages, but it is billed to Cat Credits, and it now says that.',
      'Claude Fable 5.1 was missing because Fable 5 still worked \u2014 so nothing detected it. The catalogue check now also notices when a newer version of a model we use has shipped.',
    ],
  },
  {
    date: '2026-09-20',
    tag: 'fix',
    title: 'Cat on a phone, fixed end to end',
    summary:
      'A pass over every screen of Cat and AI settings on a small screen. The box you type in stayed put, replies stopped showing their own formatting marks, and the navigation bar stopped being see-through.',
    items: [
      'The message box no longer floats into the middle of the screen when the keyboard opens.',
      'Replies render quotes and code blocks properly instead of printing the raw “>” and backticks.',
      'Your remaining daily messages were being covered by the conversations button, so the count read “f 10 left”. Both now sit in the toolbar side by side.',
      'Suggested prompts are one recommendation plus a row you swipe, and the row changes between visits rather than showing the same four boxes forever.',
      'The bottom navigation bar is opaque and stays full size — page content used to be readable straight through it, and buttons at the end of a page sat underneath it.',
      'The round button above the bar says “Receive”; it was an unlabelled QR icon.',
      'The model picker dims the page behind it, closes with Escape, and its locked models are now links to the page that unlocks them.',
      'Cat no longer claims a reply “fell back to Groq because Groq was rate-limited” — it names the model that actually answered.',
    ],
  },
  {
    date: '2026-09-19',
    tag: 'improvement',
    title: 'Build it with Loki now asks before it builds',
    summary:
      'The handoff to Loki carried this page\u2019s title and one public sentence, and an agent started work on exactly that. Loki now interviews you first \u2014 a few short questions about who it is for and what finished looks like \u2014 and builds from your answers.',
    items: [
      'Five questions, one at a time, each skippable; the build starts as soon as you are done.',
      'Your answers become the project profile Loki plans milestones and briefs its agents from.',
      'Questions are phrased around your actual page, so you are never asked what it already says.',
    ],
  },
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
