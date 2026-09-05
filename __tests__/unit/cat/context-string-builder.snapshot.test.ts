/**
 * Byte-identical snapshot of buildFullContextString across ALL context sections.
 * Guards the Cat prompt context against accidental wording/format/order changes
 * (it feeds the model every turn). System time is fixed so date/overdue output is
 * deterministic. If you intentionally change context wording, update the snapshot.
 */
import { buildFullContextString } from '@/services/ai/context-string-builder';
import type { FullUserContext } from '@/services/ai/document-context-types';

// A fixture that exercises every render branch.
const FULL_CTX = {
  profile: {
    name: 'Cato',
    username: 'mao',
    bio: 'Building OrangeCat.',
    location_city: 'Zurich',
    location_country: 'CH',
    background: 'Bitcoin since 2013.',
    website: 'https://orangecat.ch',
  },
  memories: [{ content: 'Prefers Lightning over on-chain.' }, { content: 'Based in Zurich.' }],
  documents: [
    { document_type: 'goals', title: '2026 Goals', content: 'Ship the Cat.' },
    { document_type: 'skills', title: 'Skills', content: 'TS, Bitcoin, design.' },
  ],
  entities: [
    {
      type: 'product',
      title: 'Sticker Pack',
      status: 'active',
      price_btc: 0.0001,
      category: 'merch',
      description: 'Orange stickers.',
      id: 'prod-1',
    },
    {
      type: 'project',
      title: 'Zurich Space',
      status: 'paused',
      raised_btc: 0.5,
      num_supporters: 3,
      location: 'Zurich',
      description: 'A venue.',
      id: 'proj-1',
    },
  ],
  tasks: [
    {
      title: 'Fix bug',
      is_reminder: false,
      category: 'work',
      priority: 'urgent',
      current_status: 'needs_attention',
      due_date: '2026-06-01T10:00:00Z',
      task_type: 'one_time',
      id: 'task-1',
    },
    {
      title: 'Call bank',
      is_reminder: true,
      priority: 'normal',
      current_status: 'idle',
      due_date: '2026-06-02T10:00:00Z',
      task_type: 'one_time',
      id: 'task-2',
    },
  ],
  wallets: [
    {
      label: 'Main',
      category: 'personal',
      balance_btc: 0.21,
      balance_updated_at: '2026-06-20T00:00:00Z',
      behavior_type: 'one_time_goal',
      goal_amount: 1,
      goal_currency: 'BTC',
      goal_deadline: '2026-12-31',
      is_primary: true,
    },
  ],
  conversations: [
    {
      id: 'conv-1',
      other_username: 'alice',
      has_unread: true,
      last_message_preview: 'hey there',
      last_message_is_mine: false,
    },
  ],
  inboundActivity: {
    recentSales: [
      {
        entity_title: 'Sticker Pack',
        entity_type: 'product',
        amount_btc: 0.0001,
        created_at: '2026-06-25T00:00:00Z',
      },
    ],
    upcomingBookings: [
      {
        starts_at: '2026-07-01T14:00:00Z',
        customer_display_name: 'Bob',
        customer_username: 'bob',
        status: 'confirmed',
      },
    ],
  },
  memberGroups: [
    {
      id: 'grp-1',
      name: 'Builders Guild',
      label: 'guild',
      role: 'admin',
      visibility: 'private',
      description: 'Makers who ship.',
    },
  ],
  socialGraph: {
    followers: 10,
    following: 5,
    recentFollowing: [{ username: 'alice' }, { name: 'Bob' }],
  },
  projectActivity: [
    {
      title: 'Zurich Space',
      source: 'fleetcrown',
      at: '2026-06-10T00:00:00Z',
      description: 'Milestone reached.',
    },
  ],
  stakeholders: [{ kind: 'customer', counterparty: 'Acme Corp' }],
  githubRepos: [
    {
      name: 'orangecat',
      language: 'TypeScript',
      stars: 42,
      archived: false,
      description: 'The platform.',
      pushedAt: '2026-06-28T00:00:00Z',
    },
  ],
  paymentCapabilities: { hasNwcWallet: true, lightningAddress: 'hello@orangecat.ch' },
  runtime: {
    preferredCurrency: 'CHF',
    locale: 'en-US',
    currentActor: { id: 'actor-1', type: 'group', name: 'Builders Guild' },
    btcRate: { rate: 95000, currency: 'CHF' },
    lastVisitedPath: '/dashboard/projects/proj-1',
  },
  stats: {
    totalProducts: 1,
    totalServices: 2,
    totalProjects: 1,
    totalCauses: 1,
    totalEvents: 1,
    totalAssets: 1,
    totalLoans: 1,
    totalInvestments: 0,
    totalResearch: 1,
    totalWishlists: 1,
    totalTasks: 2,
    urgentTasks: 1,
    totalWallets: 1,
  },
} as unknown as FullUserContext;

describe('buildFullContextString — full-output snapshot', () => {
  beforeAll(() => {
    vi.useFakeTimers({ now: new Date('2026-06-29T12:00:00Z'), doNotFake: ['nextTick'] });
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it('renders every section identically (byte-for-byte)', () => {
    expect(buildFullContextString(FULL_CTX)).toMatchSnapshot();
  });
});
