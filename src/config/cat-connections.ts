/**
 * CAT CONNECTIONS — the one list of what Cat is connected to.
 *
 * Cat's reach into other systems grew one integration at a time — GitHub repos
 * in the context, a Loki handoff link, Solon decisions over a webhook, a
 * Lightning wallet for payments — and each lived only in its own code. Nothing
 * could answer "what can Cat see and do, and is it connected for me?", so no
 * screen showed it and every new integration was invisible until used.
 *
 * Like ENTITY_REGISTRY, this is a list of FACTS about each connection, and
 * the rest derives from it: the Connections panel in Cat → Controls, the
 * per-user status (services/cat/connections.ts), and a test that every Cat
 * action named here really exists — a connection cannot claim a power Cat
 * does not have.
 *
 * Adding a connection (the next ones are GitHub sign-in, calendar feeds,
 * payment providers, social posting, MCP): add an entry here, a status probe
 * in services/cat/connections.ts, and — if Cat should read it every turn — a
 * fetcher in services/ai/document-context.ts.
 */

import { ECOSYSTEM } from '@/config/ecosystem';
import { ROUTES } from '@/config/routes';

export type CatConnectionId = 'loki' | 'solon' | 'github' | 'lightning';

export interface CatConnectionLink {
  label: string;
  href: string;
  kind: 'page' | 'external' | 'redirect';
}

export interface CatConnection {
  id: CatConnectionId;
  name: string;
  /** One line: what the connection is for, in the user's terms. */
  purpose: string;
  /** What Cat can see through it. */
  reads: string[];
  /** Cat actions (keys of CAT_ACTIONS) this connection makes possible. */
  actions: string[];
  /** What it tells Cat without being asked. Empty = Cat only reads on demand. */
  pushes: string[];
  /**
   * Where the user goes to connect it. `redirect` is a full-page hop through
   * our own API (an OAuth start) — never client-side navigation.
   */
  connect: CatConnectionLink;
}

export const CAT_CONNECTIONS: readonly CatConnection[] = [
  {
    id: 'loki',
    name: 'Loki',
    purpose: 'Get your sites and software built, and see how they are doing.',
    reads: [
      'Your Loki projects and whether each one is building, idle or blocked on you',
      'Which sites are live, and where',
      'New visitor feedback on your sites',
    ],
    actions: ['send_to_loki', 'build_site'],
    pushes: ['Build progress on projects you published to OrangeCat'],
    connect: {
      label: 'Sign in to Loki with OrangeCat',
      href: ECOSYSTEM.loki.siteUrl,
      kind: 'external',
    },
  },
  {
    id: 'solon',
    name: 'Solon',
    // Today Solon governs OrangeCat itself (one pinned organisation, see
    // config/solon.ts) — not the user's own groups yet. Say exactly that; the
    // entry grows when Solon does.
    purpose: 'Propose changes to how OrangeCat is run, decided by a signed vote.',
    reads: ['Platform policies that passed a vote in Solon'],
    actions: ['propose_governance_change'],
    pushes: ['Platform decisions, re-verified here before they take effect'],
    connect: { label: 'Open Solon', href: ECOSYSTEM.solon.siteUrl, kind: 'external' },
  },
  {
    id: 'github',
    name: 'GitHub',
    purpose: 'Let Cat know what you are building — and what is waiting on you.',
    // Connected through the read-only GitHub App: all three. Through only a
    // profile handle: public repositories alone (the status says which).
    reads: [
      'Your repositories — private ones too once you connect your account',
      'Issues and pull requests assigned to you',
      'Your latest releases',
    ],
    actions: [],
    pushes: [],
    // The default. services/cat/connections swaps in the account connect
    // (a redirect through /api/integrations/github/connect) when the server
    // has the GitHub App configured.
    connect: {
      label: 'Add your GitHub to your profile',
      href: ROUTES.PROFILE.EDIT,
      kind: 'page',
    },
  },
  {
    id: 'lightning',
    name: 'Lightning wallet',
    purpose: 'Receive money, and let Cat pay within the limits you set.',
    reads: ['Your wallets, balances and goals'],
    actions: ['send_payment', 'connect_wallet', 'add_wallet'],
    pushes: [],
    connect: { label: 'Set up a wallet', href: ROUTES.DASHBOARD.WALLETS, kind: 'page' },
  },
];

export function getCatConnection(id: CatConnectionId): CatConnection {
  const found = CAT_CONNECTIONS.find(c => c.id === id);
  if (!found) {
    throw new Error(`Unknown Cat connection: ${id}`);
  }
  return found;
}
