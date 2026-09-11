/**
 * My Cat Action Registry
 *
 * Defines all actions My Cat can execute on behalf of users.
 * Each action has permissions, parameters, and execution metadata.
 *
 * Created: 2026-01-21
 * Last Modified: 2026-01-21
 * Last Modified Summary: Initial implementation
 */

import {
  Package,
  Briefcase,
  Rocket,
  Heart,
  Calendar,
  MessageSquare,
  Send,
  Megaphone,
  Users,
  Eye,
  Wallet,
  Settings,
  FileText,
  Bell,
  Building2,
  TrendingUp,
  Coins,
  Gift,
  Bot,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Zap,
  type LucideIcon,
  Hammer,
} from 'lucide-react';
import { API_ROUTES } from '@/config/api-routes';
import { getApiEndpoint } from '@/config/entity-registry';

// ==================== ACTION TYPES ====================

export type ActionCategory =
  | 'entities' // Create/manage products, services, projects, etc.
  | 'communication' // Timeline posts, messages
  | 'payments' // Bitcoin transactions
  | 'organization' // Group/org management
  | 'context'; // Managing My Cat's context
// 'settings' was a category with ZERO actions in it — a switch in the
// permissions UI that governed nothing. Removed from the app (ADR-0006 D5).
// The Postgres enum public.cat_action_category still carries the value; an
// enum value cannot be dropped in place and no row references it, so it is
// left orphaned rather than migrated. Do not add it back without an action.

export type ActionRiskLevel = 'low' | 'medium' | 'high';

interface ActionParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'entity_id' | 'user_id' | 'btc' | 'array' | 'object';
  required: boolean;
  description: string;
  default?: unknown;
}

export interface CatAction {
  id: string;
  name: string;
  description: string;
  category: ActionCategory;
  icon: LucideIcon;
  riskLevel: ActionRiskLevel;
  requiresConfirmation: boolean; // Always ask user before executing
  parameters: ActionParameter[];
  examples: string[]; // Example user requests that trigger this action
  apiEndpoint?: string; // If action calls an API
  enabled: boolean; // Can be disabled globally
}

// ==================== ACTION DEFINITIONS ====================

export const CAT_ACTIONS: Record<string, CatAction> = {
  // ---------- ENTITY ACTIONS ----------

  create_product: {
    id: 'create_product',
    name: 'Create Product',
    description: 'Create a new product listing for sale',
    category: 'entities',
    icon: Package,
    riskLevel: 'medium',
    requiresConfirmation: true,
    parameters: [
      { name: 'title', type: 'string', required: true, description: 'Product title' },
      { name: 'description', type: 'string', required: false, description: 'Product description' },
      { name: 'price_btc', type: 'btc', required: true, description: 'Price in BTC (e.g., 0.001)' },
      { name: 'category', type: 'string', required: false, description: 'Product category' },
      {
        name: 'publish',
        type: 'boolean',
        required: false,
        description: 'Publish immediately',
        default: false,
      },
    ],
    examples: [
      'Create a product for my ebook',
      'List my consulting package for sale',
      'Set up a product page for my artwork',
    ],
    apiEndpoint: getApiEndpoint('product'),
    enabled: true,
  },

  create_service: {
    id: 'create_service',
    name: 'Create Service',
    description: 'Create a new service offering',
    category: 'entities',
    icon: Briefcase,
    riskLevel: 'medium',
    requiresConfirmation: true,
    parameters: [
      { name: 'title', type: 'string', required: true, description: 'Service title' },
      { name: 'description', type: 'string', required: false, description: 'Service description' },
      {
        name: 'hourly_rate',
        type: 'btc',
        required: false,
        description: 'Hourly rate in BTC (e.g., 0.001)',
      },
      {
        name: 'fixed_price',
        type: 'btc',
        required: false,
        description: 'Fixed price in BTC (e.g., 0.005)',
      },
      {
        name: 'duration_minutes',
        type: 'number',
        required: false,
        description: 'Service duration',
      },
      {
        name: 'publish',
        type: 'boolean',
        required: false,
        description: 'Publish immediately',
        default: false,
      },
    ],
    examples: [
      'Create a consulting service',
      'Offer my design services',
      'Set up a coaching session service',
    ],
    apiEndpoint: getApiEndpoint('service'),
    enabled: true,
  },

  create_project: {
    id: 'create_project',
    name: 'Create Project',
    description: 'Create a community-funded project with a funding goal',
    category: 'entities',
    icon: Rocket,
    riskLevel: 'medium',
    requiresConfirmation: true,
    parameters: [
      { name: 'title', type: 'string', required: true, description: 'Project title' },
      { name: 'description', type: 'string', required: false, description: 'Project description' },
      {
        name: 'goal_btc',
        type: 'btc',
        required: true,
        description: 'Funding goal in BTC (e.g., 0.1)',
      },
      { name: 'category', type: 'string', required: false, description: 'Project category' },
      {
        name: 'publish',
        type: 'boolean',
        required: false,
        description: 'Publish immediately',
        default: false,
      },
    ],
    examples: [
      'Start a funded project',
      'Launch my network state project',
      'Create a funding campaign for my book',
    ],
    apiEndpoint: getApiEndpoint('project'),
    enabled: true,
  },

  create_cause: {
    id: 'create_cause',
    name: 'Create Cause',
    description: 'Create an ongoing cause for supporters',
    category: 'entities',
    icon: Heart,
    riskLevel: 'medium',
    requiresConfirmation: true,
    parameters: [
      { name: 'title', type: 'string', required: true, description: 'Cause title' },
      { name: 'description', type: 'string', required: false, description: 'Cause description' },
      { name: 'category', type: 'string', required: false, description: 'Cause category' },
      {
        name: 'publish',
        type: 'boolean',
        required: false,
        description: 'Publish immediately',
        default: false,
      },
    ],
    examples: [
      'Create a cause for Bitcoin education',
      'Start a movement for digital sovereignty',
      'Set up ongoing support for my work',
    ],
    apiEndpoint: getApiEndpoint('cause'),
    enabled: true,
  },

  create_event: {
    id: 'create_event',
    name: 'Create Event',
    description: 'Create an event or meetup',
    category: 'entities',
    icon: Calendar,
    riskLevel: 'medium',
    requiresConfirmation: true,
    parameters: [
      { name: 'title', type: 'string', required: true, description: 'Event title' },
      { name: 'description', type: 'string', required: false, description: 'Event description' },
      { name: 'start_date', type: 'string', required: true, description: 'Event start date/time' },
      { name: 'location', type: 'string', required: true, description: 'Event location' },
      {
        name: 'publish',
        type: 'boolean',
        required: false,
        description: 'Publish immediately',
        default: false,
      },
    ],
    examples: [
      'Create a Bitcoin meetup',
      'Set up a conference event',
      'Organize a community gathering',
    ],
    apiEndpoint: getApiEndpoint('event'),
    enabled: true,
  },

  create_asset: {
    id: 'create_asset',
    name: 'Create Asset',
    description: 'Register a rentable or sellable asset',
    category: 'entities',
    icon: Building2,
    riskLevel: 'medium',
    requiresConfirmation: true,
    parameters: [
      { name: 'title', type: 'string', required: true, description: 'Asset title' },
      { name: 'description', type: 'string', required: false, description: 'Asset description' },
      {
        name: 'asset_type',
        type: 'string',
        required: false,
        description: 'Type of asset (equipment, space, vehicle, etc.)',
      },
      { name: 'location', type: 'string', required: false, description: 'Asset location' },
      {
        name: 'publish',
        type: 'boolean',
        required: false,
        description: 'Publish immediately',
        default: false,
      },
    ],
    examples: [
      'Register my rental equipment',
      'List my co-working space',
      'Add my property as an asset',
    ],
    apiEndpoint: getApiEndpoint('asset'),
    enabled: true,
  },

  create_investment: {
    id: 'create_investment',
    name: 'Create Investment',
    description: 'Create a structured investment opportunity (equity, revenue-share, or debt)',
    category: 'entities',
    icon: TrendingUp,
    riskLevel: 'high',
    requiresConfirmation: true,
    parameters: [
      {
        name: 'title',
        type: 'string',
        required: true,
        description: 'Investment opportunity title',
      },
      {
        name: 'description',
        type: 'string',
        required: false,
        description: 'Investment description',
      },
      {
        name: 'investment_type',
        type: 'string',
        required: false,
        description: 'Type: revenue_share, equity, debt, convertible_note, token',
        default: 'revenue_share',
      },
      {
        name: 'target_amount_btc',
        type: 'btc',
        required: true,
        description: 'Funding target in BTC (e.g., 1.0)',
      },
      {
        name: 'minimum_investment_btc',
        type: 'btc',
        required: false,
        description: 'Minimum investment per investor in BTC (default: 0.0001)',
        default: 0.0001,
      },
      {
        name: 'publish',
        type: 'boolean',
        required: false,
        description: 'Open for investment immediately (status: open)',
        default: false,
      },
    ],
    examples: [
      'Create a revenue-share investment for my startup',
      'Set up an equity round for my project',
      'Launch a Bitcoin-denominated investment opportunity',
    ],
    apiEndpoint: getApiEndpoint('investment'),
    enabled: true,
  },

  create_loan: {
    id: 'create_loan',
    name: 'Create Loan Request',
    description: 'Create a peer-to-peer Bitcoin loan request',
    category: 'entities',
    icon: Coins,
    riskLevel: 'high',
    requiresConfirmation: true,
    parameters: [
      { name: 'title', type: 'string', required: true, description: 'Loan request title' },
      {
        name: 'description',
        type: 'string',
        required: false,
        description: 'Loan purpose and details',
      },
      {
        name: 'amount_btc',
        type: 'btc',
        required: true,
        description: 'Loan amount in BTC (e.g., 0.1)',
      },
      {
        name: 'interest_rate',
        type: 'number',
        required: false,
        description: 'Desired interest rate as a percentage (e.g., 5 for 5%)',
      },
      {
        name: 'loan_type',
        type: 'string',
        required: false,
        description: 'Type: new_request (default) or existing_refinance',
        default: 'new_request',
      },
    ],
    examples: [
      'Request a Bitcoin loan for my project',
      'Borrow 0.05 BTC for equipment at 5% interest',
      'Refinance my existing loan at a lower rate',
    ],
    apiEndpoint: getApiEndpoint('loan'),
    enabled: true,
  },

  create_research: {
    id: 'create_research',
    name: 'Create Research',
    description: 'Create a decentralized science (DeSci) research entity with Bitcoin funding',
    category: 'entities',
    icon: FileText,
    riskLevel: 'medium',
    requiresConfirmation: true,
    parameters: [
      { name: 'title', type: 'string', required: true, description: 'Research title' },
      {
        name: 'description',
        type: 'string',
        required: false,
        description: 'Research description and goals',
      },
      {
        name: 'field',
        type: 'string',
        required: false,
        description:
          'Research field: biology, computer_science, mathematics, physics, economics, medicine, artificial_intelligence, blockchain_cryptography, other (default: other)',
        default: 'other',
      },
      {
        name: 'funding_goal_btc',
        type: 'btc',
        required: false,
        description: 'Funding goal in BTC (default: 0.001)',
        default: 0.001,
      },
      {
        name: 'methodology',
        type: 'string',
        required: false,
        description:
          'Research methodology: experimental, theoretical, computational, empirical, mixed_methods (default: experimental)',
        default: 'experimental',
      },
      {
        name: 'lead_researcher',
        type: 'string',
        required: false,
        description: 'Lead researcher name (defaults to your username)',
        default: '',
      },
    ],
    examples: [
      'Start a DeSci research project on AI safety',
      'Create a Bitcoin-funded biology research entity',
      'Launch a decentralized science study on climate',
    ],
    apiEndpoint: getApiEndpoint('research'),
    enabled: true,
  },

  create_wishlist: {
    id: 'create_wishlist',
    name: 'Create Wishlist',
    description: 'Create a gift registry or wishlist others can fund',
    category: 'entities',
    icon: Gift,
    riskLevel: 'low',
    requiresConfirmation: false,
    parameters: [
      {
        name: 'title',
        type: 'string',
        required: true,
        description: 'Wishlist title (e.g., "My Birthday List")',
      },
      { name: 'description', type: 'string', required: false, description: 'Wishlist description' },
      {
        name: 'type',
        type: 'string',
        required: false,
        description:
          'Wishlist type: general, birthday, wedding, baby_shower, graduation, personal (default: general)',
        default: 'general',
      },
      {
        name: 'visibility',
        type: 'string',
        required: false,
        description: 'Visibility: public, unlisted (link-only), private (default: public)',
        default: 'public',
      },
      {
        name: 'event_date',
        type: 'string',
        required: false,
        description: 'Optional event date (e.g., birthday or wedding date)',
      },
    ],
    examples: [
      'Create a birthday wishlist',
      'Set up a wedding registry',
      'Make a personal wishlist for my followers',
    ],
    apiEndpoint: getApiEndpoint('wishlist'),
    enabled: true,
  },

  create_ai_assistant: {
    id: 'create_ai_assistant',
    name: 'Create AI Assistant',
    description:
      'Build an autonomous AI service that earns Bitcoin — define its personality, capabilities, and pricing',
    category: 'entities',
    icon: Bot,
    riskLevel: 'medium',
    requiresConfirmation: true,
    parameters: [
      {
        name: 'title',
        type: 'string',
        required: true,
        description: 'Assistant name (e.g., "Bitcoin Tax Advisor", "Code Reviewer")',
      },
      {
        name: 'description',
        type: 'string',
        required: false,
        description: 'What the assistant does, who it helps, and how',
      },
      {
        name: 'system_prompt',
        type: 'string',
        required: true,
        description:
          "Core instruction that defines the AI's behavior — the software you're creating",
      },
      {
        name: 'pricing_model',
        type: 'string',
        required: false,
        description:
          'Pricing model: free, per_message, per_token, subscription (default: per_message)',
        default: 'per_message',
      },
      {
        name: 'category',
        type: 'string',
        required: false,
        description:
          'Category: Writing & Content, Code & Development, Customer Support, Education & Tutoring, Business & Consulting, Research & Analysis, Entertainment, Other',
        default: 'Other',
      },
    ],
    examples: [
      'Create a Bitcoin tax advisor AI assistant',
      'Build a code reviewer that charges per message',
      'Launch a free educational assistant about Lightning Network',
    ],
    apiEndpoint: getApiEndpoint('ai_assistant'),
    enabled: true,
  },

  create_circle: {
    id: 'create_circle',
    name: 'Create Circle',
    description: 'Start a lightweight community circle around a shared interest',
    category: 'entities',
    icon: Users,
    riskLevel: 'medium',
    requiresConfirmation: true,
    parameters: [
      { name: 'title', type: 'string', required: true, description: 'Circle name' },
      {
        name: 'description',
        type: 'string',
        required: false,
        description: 'What the circle is about',
      },
      { name: 'category', type: 'string', required: false, description: 'Circle category' },
      {
        name: 'visibility',
        type: 'string',
        required: false,
        description: 'public | unlisted | private (default: public)',
        default: 'public',
      },
      {
        name: 'publish',
        type: 'boolean',
        required: false,
        description: 'Make it live immediately',
        default: false,
      },
    ],
    examples: [
      'Start a circle for Zurich makers',
      'Create a community for Bitcoin beginners',
      'Set up an interest circle for ceramics',
    ],
    apiEndpoint: getApiEndpoint('circle'),
    enabled: true,
  },

  /**
   * Commission a real, deployed website from FleetCrown's site factory.
   *
   * `high` risk and always confirmed, and the reason is not that it spends
   * money — it does not. It creates a repository, a public subdomain and a TLS
   * certificate, in the open, under the studio's name. Those are externally
   * visible and cannot be un-spent against the rate limits they consume, which
   * is precisely the shape of thing a user should see named before it happens.
   * The autonomy ladder refuses `auto` for high risk, so this can never become
   * a thing Cat does unattended.
   */
  build_site: {
    id: 'build_site',
    name: 'Build a Website',
    description:
      'Commission FleetCrown to build and deploy a real website on its own subdomain. Queued, not instant: the reply must say a build was STARTED, never that a site is ready.',
    category: 'entities',
    icon: Hammer,
    riskLevel: 'high',
    requiresConfirmation: true,
    parameters: [
      {
        name: 'slug',
        type: 'string',
        required: true,
        description: 'Subdomain to build on, lowercase letters/digits/hyphens (e.g. "kraftwerk")',
      },
      { name: 'title', type: 'string', required: true, description: 'What the site is called' },
      {
        name: 'kind',
        type: 'string',
        required: false,
        description: 'demo | product | client-site (default: product)',
        default: 'product',
      },
    ],
    examples: [
      'Build me a website for my bakery',
      'Can you make a real site for this project?',
      'Set up a landing page on its own domain',
    ],
    enabled: true,
  },

  create_project_for_person: {
    id: 'create_project_for_person',
    name: 'Set Up a Project for Someone Else',
    description:
      'Page for a person with no account + a project owned by THEM; returns the link they take it over with. No money until they accept.',
    category: 'entities',
    icon: Gift,
    riskLevel: 'medium',
    requiresConfirmation: true,
    parameters: [
      {
        name: 'person_name',
        type: 'string',
        required: true,
        description: 'Who it is for, e.g. "Annushka"',
      },
      { name: 'title', type: 'string', required: true, description: 'Project title' },
      {
        name: 'description',
        type: 'string',
        required: false,
        description: 'What it is, in their voice',
      },
      {
        name: 'goal_btc',
        type: 'btc',
        required: false,
        description: 'Funding goal in BTC — ONLY if the user named an amount; never invent one',
      },
      { name: 'category', type: 'string', required: false, description: 'Project category' },
      {
        name: 'person_bio',
        type: 'string',
        required: false,
        description: 'A line about them, for their page',
      },
      {
        name: 'person_website',
        type: 'string',
        required: false,
        description: 'Their website, if any',
      },
    ],
    examples: [
      'My friend Maria wants to open an art studio — set it up for her',
      'This project is for Annushka, she is not registered yet',
      "Create a page for my mother's bakery, she does not use computers",
    ],
    apiEndpoint: API_ROUTES.PROFILE_CLAIMS.BASE,
    enabled: true,
  },

  send_to_fleetcrown: {
    id: 'send_to_fleetcrown',
    name: 'Send to FleetCrown',
    description:
      'Hand an entity to FleetCrown, where AI agents build it (site, app, launch). Returns a 10-minute link. Works for pages set up for someone else.',
    category: 'entities',
    icon: Hammer,
    riskLevel: 'low',
    requiresConfirmation: true,
    parameters: [
      {
        name: 'title',
        type: 'string',
        required: false,
        description: 'Title of the entity (id preferred when known)',
      },
      { name: 'entity_id', type: 'entity_id', required: false, description: 'Entity id' },
      {
        name: 'entity_type',
        type: 'string',
        required: false,
        description: 'project (default), product, service…',
        default: 'project',
      },
    ],
    examples: [
      'Can she build this with FleetCrown?',
      'Send the networking platform to FleetCrown',
      'Build the website for this project',
    ],
    apiEndpoint: API_ROUTES.INTEGRATIONS.FLEETCROWN_BUILD_INTENTS,
    enabled: true,
  },

  update_entity: {
    id: 'update_entity',
    name: 'Update Entity',
    description: 'Update an existing product, service, project, cause, or event',
    category: 'entities',
    icon: Settings,
    riskLevel: 'medium',
    requiresConfirmation: true,
    parameters: [
      { name: 'entity_type', type: 'string', required: true, description: 'Type of entity' },
      { name: 'entity_id', type: 'entity_id', required: true, description: 'Entity ID to update' },
      // An object, and always was — callers pass `{ title: '…' }`. Declaring
      // it 'string' was harmless only while nothing validated the
      // declaration; the moment something did, every update failed.
      {
        name: 'updates',
        type: 'object',
        required: true,
        description: 'Fields to update, as an object',
      },
    ],
    examples: [
      'Update my product price',
      'Change the description of my service',
      'Update the funding goal',
    ],
    enabled: true,
  },

  publish_entity: {
    id: 'publish_entity',
    name: 'Publish Entity',
    description: 'Make a draft entity live and visible',
    category: 'entities',
    icon: Megaphone,
    riskLevel: 'medium',
    requiresConfirmation: true,
    parameters: [
      { name: 'entity_type', type: 'string', required: true, description: 'Type of entity' },
      { name: 'entity_id', type: 'entity_id', required: true, description: 'Entity ID to publish' },
    ],
    examples: ['Publish my product', 'Make my project live', 'Launch my service'],
    enabled: true,
  },

  archive_entity: {
    id: 'archive_entity',
    name: 'Archive Entity',
    description:
      'Archive (soft-delete) a product, service, project, cause, or event — sets status to archived and removes it from public view',
    category: 'entities',
    icon: Settings,
    riskLevel: 'high',
    requiresConfirmation: true,
    parameters: [
      {
        name: 'entity_type',
        type: 'string',
        required: true,
        description: 'Type of entity (product, service, project, cause, event, etc.)',
      },
      { name: 'entity_id', type: 'entity_id', required: true, description: 'Entity ID to archive' },
    ],
    examples: [
      'Delete my old product',
      'Remove that service from my profile',
      'Archive the project we cancelled',
    ],
    enabled: true,
  },

  // ---------- COMMUNICATION ACTIONS ----------

  post_to_timeline: {
    id: 'post_to_timeline',
    name: 'Post to Timeline',
    description: 'Create a public post on your timeline',
    category: 'communication',
    icon: Megaphone,
    riskLevel: 'medium',
    requiresConfirmation: true,
    parameters: [
      { name: 'content', type: 'string', required: true, description: 'Post content' },
      {
        name: 'visibility',
        type: 'string',
        required: false,
        description: 'public (default) or private',
        default: 'public',
      },
      {
        name: 'entity_id',
        type: 'entity_id',
        required: false,
        description: 'Entity to link/promote (pass entity_type too)',
      },
      {
        name: 'entity_type',
        type: 'string',
        required: false,
        description:
          'Type of the linked entity (project, product, cause, event, …) — required when entity_id is set',
      },
    ],
    examples: [
      'Post about my new product',
      'Announce my project launch',
      'Share an update with my followers',
    ],
    enabled: true,
  },

  send_message: {
    id: 'send_message',
    name: 'Send Message',
    description: 'Send a private message to another user',
    category: 'communication',
    icon: MessageSquare,
    riskLevel: 'high',
    requiresConfirmation: true,
    parameters: [
      { name: 'recipient_id', type: 'user_id', required: false, description: 'User to message' },
      {
        name: 'recipient',
        type: 'string',
        required: true,
        description: '@username — the only handle Cat can know; the handler resolves it to an id',
      },
      { name: 'content', type: 'string', required: true, description: 'Message content' },
    ],
    examples: [
      'Message John about collaboration',
      'Send a thank you to my supporter',
      'Reach out to that Bitcoin developer',
    ],
    apiEndpoint: API_ROUTES.MESSAGES.BASE,
    enabled: true,
  },

  reply_to_message: {
    id: 'reply_to_message',
    name: 'Reply to Message',
    description: 'Reply to a message in an existing conversation',
    category: 'communication',
    icon: Send,
    riskLevel: 'medium',
    requiresConfirmation: true,
    parameters: [
      { name: 'conversation_id', type: 'string', required: true, description: 'Conversation ID' },
      { name: 'content', type: 'string', required: true, description: 'Reply content' },
    ],
    examples: ['Reply to that message', 'Respond to the inquiry', 'Answer their question'],
    enabled: true,
  },

  follow_user: {
    id: 'follow_user',
    name: 'Follow User',
    description: 'Follow another user on OrangeCat (their posts appear in the timeline feed)',
    category: 'communication',
    icon: Users,
    riskLevel: 'low',
    requiresConfirmation: false,
    parameters: [
      { name: 'username', type: 'string', required: true, description: 'The @username to follow' },
    ],
    examples: ['Follow @alice', 'Follow that designer we found'],
    enabled: true,
  },

  unfollow_user: {
    id: 'unfollow_user',
    name: 'Unfollow User',
    description: 'Stop following a user',
    category: 'communication',
    icon: Users,
    riskLevel: 'low',
    requiresConfirmation: false,
    parameters: [
      {
        name: 'username',
        type: 'string',
        required: true,
        description: 'The @username to unfollow',
      },
    ],
    examples: ['Unfollow @bob'],
    enabled: true,
  },

  like_post: {
    id: 'like_post',
    name: 'Like Post',
    description: 'Like a timeline post (pass the post id from context or search results)',
    category: 'communication',
    icon: Heart,
    riskLevel: 'low',
    requiresConfirmation: false,
    parameters: [
      { name: 'post_id', type: 'string', required: true, description: 'Timeline post/event id' },
    ],
    examples: ['Like that post', "Like @alice's update"],
    enabled: true,
  },

  comment_on_post: {
    id: 'comment_on_post',
    name: 'Comment on Post',
    description: 'Comment on a timeline post on behalf of the user (their words, confirmed)',
    category: 'communication',
    icon: MessageSquare,
    riskLevel: 'medium',
    requiresConfirmation: true,
    parameters: [
      { name: 'post_id', type: 'string', required: true, description: 'Timeline post/event id' },
      { name: 'content', type: 'string', required: true, description: 'The comment text' },
    ],
    examples: ['Comment "congrats!" on that post', 'Reply to their update with my thoughts'],
    enabled: true,
  },

  mark_notifications_read: {
    id: 'mark_notifications_read',
    name: 'Mark Notifications Read',
    description: 'Clear the unread notification badge — marks all notifications as read',
    category: 'context',
    icon: Bell,
    riskLevel: 'low',
    requiresConfirmation: false,
    parameters: [],
    examples: ['Mark my notifications as read', 'Clear my inbox badge'],
    enabled: true,
  },

  request_introduction: {
    id: 'request_introduction',
    name: 'Request Introduction',
    description:
      "Put the user in touch with the person behind an entity they discovered: opens a direct conversation and sends their intro message. Use after explore_topic when the user wants to connect ('introduce me', 'put me in touch', 'reach out to them'). Draft the message in the USER's voice — who they are and why they're reaching out — and show it to them before sending.",
    category: 'communication',
    icon: Users,
    riskLevel: 'high',
    requiresConfirmation: true,
    parameters: [
      {
        name: 'entity_type',
        type: 'string',
        required: true,
        description:
          'Type of the entity from the discovery results (project, research, service, …)',
      },
      {
        name: 'entity_id',
        type: 'entity_id',
        required: true,
        description: 'Id of that entity — its owner is who gets the message',
      },
      {
        name: 'message',
        type: 'string',
        required: true,
        description:
          "The intro to send, written in the user's first person. Say who they are and why this work interests them. Min 10 chars.",
      },
    ],
    examples: [
      'Introduce me to whoever is running that longevity study',
      'Put me in touch with the person behind that project',
    ],
    enabled: true,
  },

  publish_interest: {
    id: 'publish_interest',
    name: 'Publish Interest',
    description:
      "Add a topic to the user's PUBLIC INTERESTS LIST so other people searching that topic can find them. This is NOT update_profile — it does not touch their bio or background, it adds a searchable topic tag. Use this, never update_profile, whenever the goal is being findable by topic. Offer it when they express an interest ('I'm into longevity') or when explore_topic finds nothing — being findable is the fix for an empty result. It makes something public: say plainly that the topic becomes visible to anyone signed in, and wait for a clear yes. Never publish a topic they only mentioned in passing, and never publish anything sensitive (health, finances, relationships, politics, anything they asked you to keep private).",
    category: 'context',
    icon: Users,
    riskLevel: 'high',
    requiresConfirmation: true,
    parameters: [
      {
        name: 'topic',
        type: 'string',
        required: true,
        description:
          'Short topic in the user\'s own words, 2–80 chars, no lead-in ("longevity research", not "I am interested in longevity research")',
      },
    ],
    examples: [
      'Make my interest in longevity discoverable',
      'Add Bitcoin education to my interests',
    ],
    enabled: true,
  },

  unpublish_interest: {
    id: 'unpublish_interest',
    name: 'Remove Interest',
    description:
      'Remove a topic from the user\'s public interests — they stop being discoverable for it. This is NOT forget_memories: it removes a PUBLIC listing and touches no private memory. Use it, never forget_memories, whenever the user says "remove my interest(s)", "stop being findable for X", or names something they published. Always honour it immediately and without argument.',
    category: 'context',
    icon: Users,
    riskLevel: 'low',
    requiresConfirmation: false,
    parameters: [
      {
        name: 'topic',
        type: 'string',
        required: true,
        description: 'The interest to remove (matched loosely against what they published)',
      },
    ],
    examples: ['Remove longevity from my interests', 'Stop showing that I am into tattoo art'],
    enabled: true,
  },

  watch_topic: {
    id: 'watch_topic',
    name: 'Watch Topic',
    description:
      "Notify the user when someone new appears on OrangeCat working on a topic. Offer this whenever explore_topic comes back empty — it turns 'nothing here yet' into a standing subscription instead of a dead end.",
    category: 'context',
    icon: Eye,
    riskLevel: 'low',
    requiresConfirmation: false,
    parameters: [
      {
        name: 'topic',
        type: 'string',
        required: true,
        description: 'The topic to watch, 2–80 chars',
      },
    ],
    examples: [
      'Tell me when someone posts about longevity',
      'Let me know if anyone starts a Bitcoin meetup here',
    ],
    enabled: true,
  },

  book_service: {
    id: 'book_service',
    name: 'Book Service',
    description:
      "Request a booking for someone's service at a specific time (the provider must confirm). Take service_id from context or search results.",
    category: 'payments',
    icon: Calendar,
    riskLevel: 'high',
    requiresConfirmation: true,
    parameters: [
      { name: 'service_id', type: 'entity_id', required: true, description: 'The service to book' },
      {
        name: 'starts_at',
        type: 'string',
        required: true,
        description: 'Start date-time (ISO 8601)',
      },
      {
        name: 'ends_at',
        type: 'string',
        required: false,
        description: 'End date-time (default: 1 hour after start)',
      },
      { name: 'notes', type: 'string', required: false, description: 'Note for the provider' },
    ],
    examples: ['Book that consultation for Tuesday 10:00', "Book @alice's design session"],
    enabled: true,
  },

  accept_booking: {
    id: 'accept_booking',
    name: 'Accept Booking',
    description: 'Confirm an incoming booking request on one of your services/assets',
    category: 'payments',
    icon: Calendar,
    riskLevel: 'medium',
    requiresConfirmation: false,
    parameters: [
      {
        name: 'booking_id',
        type: 'string',
        required: true,
        description: 'The booking id (from your bookings context)',
      },
    ],
    examples: ['Accept the booking from @bob', 'Confirm that booking'],
    enabled: true,
  },

  decline_booking: {
    id: 'decline_booking',
    name: 'Decline Booking',
    description: 'Decline an incoming booking request',
    category: 'payments',
    icon: Calendar,
    riskLevel: 'medium',
    requiresConfirmation: true,
    parameters: [
      { name: 'booking_id', type: 'string', required: true, description: 'The booking id' },
      { name: 'reason', type: 'string', required: false, description: 'Optional reason' },
    ],
    examples: ['Decline that booking', "Reject the request — I'm away that week"],
    enabled: true,
  },

  // ---------- PAYMENT ACTIONS ----------

  send_payment: {
    id: 'send_payment',
    name: 'Send Payment',
    description: 'Send Bitcoin to another user or lightning address',
    category: 'payments',
    icon: Wallet,
    riskLevel: 'high',
    requiresConfirmation: true,
    parameters: [
      {
        name: 'amount_btc',
        type: 'btc',
        required: true,
        description: 'Amount in BTC (e.g., 0.0001)',
      },
      {
        name: 'recipient',
        type: 'string',
        required: true,
        description: 'Username or lightning address',
      },
      { name: 'memo', type: 'string', required: false, description: 'Payment memo' },
    ],
    examples: [
      'Send 0.0001 BTC to @alice',
      'Pay for the service I ordered',
      'Tip a small amount to that creator',
    ],
    enabled: true,
  },

  connect_wallet: {
    id: 'connect_wallet',
    name: 'Connect Wallet',
    description:
      'Make the user able to RECEIVE Bitcoin — store the Lightning address, Bitcoin address/xpub or NWC string they paste. The setup step, NOT add_wallet (a savings goal on top of a rail they already have). No wallet at all? Point them at a provider first, then run this.',
    category: 'payments',
    icon: Zap,
    riskLevel: 'high',
    requiresConfirmation: true,
    parameters: [
      {
        name: 'wallet_string',
        type: 'string',
        required: true,
        description:
          'Exactly what the user pasted — a Lightning address (you@provider.com), a Bitcoin address or xpub/ypub/zpub, or a nostr+walletconnect:// string. Do not reformat it.',
      },
      {
        name: 'label',
        type: 'string',
        required: false,
        description: 'Name for the wallet if a new one has to be created (default "Main wallet")',
      },
    ],
    examples: [
      'My lightning address is me@primal.net',
      'Here is my wallet: bc1q…',
      'Connect this wallet: nostr+walletconnect://…',
      'Set me up so people can pay me',
    ],
    enabled: true,
  },

  add_wallet: {
    id: 'add_wallet',
    name: 'Add Wallet',
    description:
      "Create a savings goal or budget wallet on the user's profile — a bucket to save toward, NOT a way to get paid. Use connect_wallet to give the user a receiving rail; this action reuses one they already have.",
    category: 'payments',
    icon: Wallet,
    riskLevel: 'medium',
    requiresConfirmation: false,
    parameters: [
      {
        name: 'label',
        type: 'string',
        required: true,
        description: 'Wallet name (e.g. "Vacation Fund", "Food Budget")',
      },
      {
        name: 'behavior_type',
        type: 'string',
        required: true,
        description:
          '"one_time_goal" (save toward a target) | "recurring_budget" (periodic spending limit) | "general"',
      },
      {
        name: 'category',
        type: 'string',
        required: false,
        description:
          'general | rent | food | medical | education | emergency | transportation | utilities | projects | legal | entertainment',
      },
      {
        name: 'description',
        type: 'string',
        required: false,
        description: 'What this wallet is for',
      },
      {
        name: 'goal_amount',
        type: 'number',
        required: false,
        description: 'Target amount in BTC (for one_time_goal)',
      },
      {
        name: 'goal_currency',
        type: 'string',
        required: false,
        description: 'Currency for the goal (e.g. BTC, CHF, USD)',
      },
      {
        name: 'goal_deadline',
        type: 'string',
        required: false,
        description: 'ISO date for the goal deadline (e.g. 2026-12-31)',
      },
      {
        name: 'budget_amount',
        type: 'number',
        required: false,
        description: 'Budget amount in BTC per period (for recurring_budget)',
      },
      {
        name: 'budget_period',
        type: 'string',
        required: false,
        description: 'daily | weekly | monthly | quarterly | yearly',
      },
      {
        name: 'lightning_address',
        type: 'string',
        required: false,
        description: "Lightning address to associate (uses primary wallet's address if omitted)",
      },
    ],
    examples: [
      'Set up a vacation savings goal for 0.05 BTC by December',
      'Create a monthly food budget of 0.002 BTC',
      'Start an emergency fund',
      'I want to save for a new laptop — 0.1 BTC by end of year',
    ],
    enabled: true,
  },

  fund_project: {
    id: 'fund_project',
    name: 'Fund Project',
    description: 'Contribute Bitcoin to a project',
    category: 'payments',
    icon: Rocket,
    riskLevel: 'high',
    requiresConfirmation: true,
    parameters: [
      { name: 'project_id', type: 'entity_id', required: true, description: 'Project to fund' },
      {
        name: 'amount_btc',
        type: 'btc',
        required: true,
        description: 'Amount in BTC (e.g., 0.001)',
      },
      { name: 'message', type: 'string', required: false, description: 'Support message' },
    ],
    examples: [
      'Fund that network state project with 0.001 BTC',
      'Support the Bitcoin education project',
      'Contribute to their project',
    ],
    enabled: true,
  },

  // ---------- ORGANIZATION ACTIONS ----------

  create_organization: {
    id: 'create_organization',
    name: 'Create Organization',
    description: 'Create a new organization or group',
    category: 'organization',
    icon: Users,
    riskLevel: 'medium',
    requiresConfirmation: true,
    parameters: [
      { name: 'name', type: 'string', required: true, description: 'Organization name' },
      { name: 'description', type: 'string', required: false, description: 'Description' },
      { name: 'type', type: 'string', required: false, description: 'Organization type' },
    ],
    examples: [
      'Create an organization for my project',
      'Set up a group for collaborators',
      'Start a company on OrangeCat',
    ],
    apiEndpoint: API_ROUTES.GROUPS.BASE,
    enabled: true,
  },

  propose_governance_change: {
    id: 'propose_governance_change',
    name: 'Propose Governance Change',
    description:
      'Propose new platform spending ceilings for the Cat via a Solon vote — files only, voters decide',
    category: 'organization',
    icon: ShieldCheck,
    riskLevel: 'high',
    requiresConfirmation: true, // a human okays the filing before it leaves the system
    parameters: [
      { name: 'title', type: 'string', required: true, description: 'Proposal title' },
      {
        name: 'rationale',
        type: 'string',
        required: true,
        description: 'Why — shown to voters',
      },
      {
        name: 'max_cat_daily_spend_btc',
        type: 'btc',
        required: true,
        description: 'Proposed platform daily ceiling (BTC)',
      },
      {
        name: 'max_cat_btc_per_action',
        type: 'btc',
        required: true,
        description: 'Proposed per-payment ceiling (BTC)',
      },
    ],
    examples: ['Propose raising your daily spending ceiling to 0.002 BTC'],
    enabled: true,
  },

  invite_to_organization: {
    id: 'invite_to_organization',
    name: 'Invite to Organization',
    description: 'Invite a user to join your organization',
    category: 'organization',
    icon: Users,
    riskLevel: 'medium',
    requiresConfirmation: true,
    parameters: [
      {
        name: 'organization_id',
        type: 'entity_id',
        required: true,
        description: 'Organization ID',
      },
      { name: 'user_id', type: 'user_id', required: false, description: 'User to invite' },
      {
        name: 'username',
        type: 'string',
        required: true,
        description: '@username of the invitee — what Cat can know; the handler resolves it',
      },
      {
        name: 'role',
        type: 'string',
        required: false,
        description: 'Role in organization',
        default: 'member',
      },
    ],
    examples: [
      'Invite Alice to my organization',
      'Add Bob as an admin to the group',
      'Bring in that developer as a contributor',
    ],
    enabled: true,
  },

  // ---------- CONTEXT ACTIONS ----------

  save_economic_profile: {
    id: 'save_economic_profile',
    name: 'Save Economic Profile',
    description:
      'Save latent economic value the user reveals — skills, things they own to rent/sell, goals, constraints, what people come to them for, engagement scope they are not taking on, motivation, or stage — into their structured economic profile so Cat can suggest better offers. Skills, asked-for, and not-available-for are shown on their public profile; constraints, motivation, and stage stay private.',
    category: 'context',
    icon: TrendingUp,
    riskLevel: 'low',
    requiresConfirmation: false,
    parameters: [
      {
        name: 'skills',
        type: 'array',
        required: false,
        description: 'Skills — strings, or {name, level?, years?}',
      },
      {
        name: 'assets',
        type: 'array',
        required: false,
        description: 'Things they own that could be rented/sold — strings, or {name, type?}',
      },
      {
        name: 'goals',
        type: 'array',
        required: false,
        description: 'Goals — strings, or {text, kind: earn|fund|learn|connect|build}',
      },
      {
        name: 'constraints',
        type: 'array',
        required: false,
        description: 'Constraints, e.g. "only evenings", "no upfront capital"',
      },
      {
        name: 'asked_for',
        type: 'array',
        required: false,
        description: 'What people come to them for (the richest signal)',
      },
      {
        name: 'not_available_for',
        type: 'array',
        required: false,
        description:
          'PUBLIC — engagements they explicitly do not take on right now, shown on their profile next to what they offer. E.g. "full-time roles", "backend-only gigs", "advisory only, no hands-on coding", "nothing under 3 months". Only for engagement scope, not private life constraints (those go in constraints).',
      },
      {
        name: 'motivation',
        type: 'string',
        required: false,
        description: 'Why they are here: earn / community / meaning / learn / unsure',
      },
      {
        name: 'stage',
        type: 'string',
        required: false,
        description: 'exploring / has-offers / scaling',
      },
    ],
    examples: [
      "I'm a translator and I fix bikes on weekends",
      'I have a spare workshop I could rent out',
      'I want to earn from my design skills',
      "I do fractional CTO work — technical advisory and product strategy, but I'm not taking on full-time roles or hands-on coding right now",
    ],
    enabled: true,
  },
  forget_memories: {
    id: 'forget_memories',
    name: 'Forget About Me',
    description:
      "Delete stored facts the user says are wrong or wants removed — clears BOTH Cat's memories and the matching economic-profile entries. Use when the user says something you know about them is incorrect ('I don't speak French', 'remove the photography thing'). NOT for interests: 'remove my interests' or 'stop being findable for X' means unpublish_interest, a public listing — deleting memories there destroys private data the user never asked you to touch.",
    category: 'context',
    icon: Shield,
    riskLevel: 'low',
    requiresConfirmation: false,
    parameters: [
      {
        name: 'facts',
        type: 'array',
        required: true,
        description:
          'The wrong or unwanted facts, one short phrase each, close to the user\'s wording (e.g. ["photography skills", "speaks French"]).',
      },
    ],
    examples: [
      "I don't actually speak French — remove that",
      'The weekend availability thing is wrong, forget it',
    ],
    enabled: true,
  },
  remember_fact: {
    id: 'remember_fact',
    name: 'Remember Fact',
    description:
      'Store facts the user explicitly asks Cat to remember ("remember that I…"). Overrides any earlier forget of the same fact — a deliberate statement outranks a past deletion.',
    category: 'context',
    icon: FileText,
    riskLevel: 'low',
    requiresConfirmation: false,
    parameters: [
      {
        name: 'facts',
        type: 'array',
        required: true,
        description:
          'Short third-person facts to store (e.g. ["Speaks Italian", "Prefers morning meetings"]). Max 5 per call.',
      },
    ],
    examples: [
      'Remember that I speak Italian',
      'Note that my workshop is in Basel',
      "Don't forget I prefer Lightning payments",
    ],
    enabled: true,
  },
  edit_memory: {
    id: 'edit_memory',
    name: 'Edit Memory',
    description:
      'Correct ONE stored memory in place when the user says a remembered fact is slightly wrong ("it\'s 45 CHF, not 40"). Use forget_memories instead when the fact should simply be removed.',
    category: 'context',
    icon: Settings,
    riskLevel: 'low',
    requiresConfirmation: false,
    parameters: [
      {
        name: 'match',
        type: 'string',
        required: true,
        description: 'A short phrase identifying WHICH memory to change, close to its wording.',
      },
      {
        name: 'new_content',
        type: 'string',
        required: true,
        description: 'The corrected fact, written in the third person.',
      },
    ],
    examples: [
      'Actually my mug costs 45 CHF, not 40 — fix that',
      "I moved — I'm in Bern now, not Zurich",
    ],
    enabled: true,
  },
  add_context: {
    id: 'add_context',
    name: 'Add Context',
    description: 'Add new context document for your Cat to know about',
    category: 'context',
    icon: FileText,
    riskLevel: 'low',
    requiresConfirmation: false,
    parameters: [
      { name: 'title', type: 'string', required: true, description: 'Document title' },
      { name: 'content', type: 'string', required: true, description: 'Document content' },
      {
        name: 'document_type',
        type: 'string',
        required: false,
        description: 'Type of document',
        default: 'notes',
      },
    ],
    examples: [
      'Remember that I want to focus on Bitcoin education',
      'Add to my context that my budget is 0.01 BTC',
      'Note that my goal is to launch by March',
    ],
    apiEndpoint: getApiEndpoint('document'),
    enabled: true,
  },

  // ---------- PRODUCTIVITY ACTIONS ----------

  create_task: {
    id: 'create_task',
    name: 'Create Task',
    description: 'Create a task or to-do item',
    category: 'context',
    icon: FileText,
    riskLevel: 'low',
    requiresConfirmation: false,
    parameters: [
      { name: 'title', type: 'string', required: true, description: 'Task title' },
      { name: 'notes', type: 'string', required: false, description: 'Task notes / description' },
      {
        name: 'priority',
        type: 'string',
        required: false,
        description: 'Priority: low, normal, high, urgent (not medium — DB enum uses normal)',
        default: 'normal',
      },
      {
        name: 'due_date',
        type: 'string',
        required: false,
        description: 'Due date (ISO format)',
      },
    ],
    examples: [
      'Create a task to review my project proposal',
      'Add a high priority task to follow up with investors',
      'Remind me to update my service listing by Friday',
    ],
    apiEndpoint: API_ROUTES.TASKS.BASE,
    enabled: true,
  },

  complete_task: {
    id: 'complete_task',
    name: 'Complete Task',
    description: 'Mark a task or reminder as completed',
    category: 'context',
    icon: Bell,
    riskLevel: 'low',
    requiresConfirmation: false,
    parameters: [
      {
        name: 'task_id',
        type: 'string',
        required: true,
        description: 'The task UUID from context (shown as [task_id: ...])',
      },
      {
        name: 'notes',
        type: 'string',
        required: false,
        description: 'Optional completion notes',
      },
    ],
    examples: [
      'Mark the call dentist reminder as done',
      'I finished the invoice task, mark it complete',
      'Done with that — check it off',
    ],
    apiEndpoint: API_ROUTES.TASKS.COMPLETE(':id'),
    enabled: true,
  },

  update_task: {
    id: 'update_task',
    name: 'Update Task',
    description: 'Update a task or reminder — reschedule, rename, or change priority',
    category: 'context',
    icon: Settings,
    riskLevel: 'low',
    requiresConfirmation: false,
    parameters: [
      {
        name: 'task_id',
        type: 'string',
        required: true,
        description: 'The task UUID from context (shown as [task_id: ...])',
      },
      {
        name: 'title',
        type: 'string',
        required: false,
        description: 'New title (omit to keep existing)',
      },
      {
        name: 'due_date',
        type: 'string',
        required: false,
        description: 'New due date — ISO 8601 or natural language ("next week", "in 2 hours")',
      },
      {
        name: 'notes',
        type: 'string',
        required: false,
        description: 'New notes/description (omit to keep existing)',
      },
      {
        name: 'priority',
        type: 'string',
        required: false,
        description: 'New priority: low, normal, high, urgent',
      },
    ],
    examples: [
      'Move that reminder to next Monday',
      'Reschedule the dentist reminder to next week',
      'Change the task title to something clearer',
      'Make that task high priority',
    ],
    enabled: true,
  },

  create_watch: {
    id: 'create_watch',
    name: 'Create Watch',
    description:
      'Watch a condition and notify the user when it becomes true: funding_reached (an entity\'s settled funding hits target_btc), sale_received (their next paid sale), or booking_received (their next incoming booking). Use when the user says "tell me when…" about money/sales/bookings. Checked every 15 minutes.',
    category: 'context',
    icon: Bell,
    riskLevel: 'low',
    requiresConfirmation: false,
    parameters: [
      {
        name: 'kind',
        type: 'string',
        required: true,
        description: 'funding_reached | sale_received | booking_received',
      },
      {
        name: 'label',
        type: 'string',
        required: true,
        description:
          'What to tell the user when it fires, in their words (e.g. "Your project reached 0.05 BTC!")',
      },
      {
        name: 'entity_id',
        type: 'entity_id',
        required: false,
        description: 'Entity being funded (required for funding_reached — take it from context)',
      },
      {
        name: 'entity_type',
        type: 'string',
        required: false,
        description: 'Type of that entity (project, cause, …)',
      },
      {
        name: 'target_btc',
        type: 'btc',
        required: false,
        description: 'Funding target in BTC (required for funding_reached)',
      },
    ],
    examples: [
      'Tell me when my project reaches 0.05 BTC',
      'Let me know when someone books me',
      'Notify me on my next sale',
    ],
    enabled: true,
  },

  cancel_watch: {
    id: 'cancel_watch',
    name: 'Cancel Watch',
    description:
      'Stop an active watch. Pass watch_id when known; without it, the single active watch is cancelled, or the result lists the active watches to choose from.',
    category: 'context',
    icon: Bell,
    riskLevel: 'low',
    requiresConfirmation: false,
    parameters: [
      {
        name: 'watch_id',
        type: 'string',
        required: false,
        description: 'The watch UUID (from an earlier create_watch result or cancel_watch listing)',
      },
    ],
    examples: ['Stop watching my project funding', 'Cancel that watch'],
    enabled: true,
  },

  // ---------- NOTIFICATION ACTIONS ----------

  set_reminder: {
    id: 'set_reminder',
    name: 'Set Reminder',
    description: 'Set a reminder for yourself',
    category: 'context',
    icon: Bell,
    riskLevel: 'low',
    requiresConfirmation: false,
    parameters: [
      { name: 'title', type: 'string', required: true, description: 'What to be reminded about' },
      {
        name: 'due_date',
        type: 'string',
        required: true,
        description: 'When — ISO 8601 or natural language ("tomorrow", "in 2 hours")',
      },
      {
        name: 'notes',
        type: 'string',
        required: false,
        description: 'Optional additional context',
      },
    ],
    examples: [
      'Remind me to check on my project tomorrow',
      'Set a reminder for the meeting next week',
      'Notify me when funding reaches 50%',
    ],
    enabled: true,
  },

  // ---------- PROFILE ACTIONS ----------

  update_profile: {
    id: 'update_profile',
    name: 'Update Profile',
    description:
      "Update the user's public profile — handle, name, bio, background, location, or website. Changing the @handle IS supported: the old one keeps redirecting and still receives payments. To make someone findable for a TOPIC use publish_interest instead, which adds a searchable interest rather than rewriting their bio.",
    // ADR-0006 D5. This sat in 'context' (granted by default) with no
    // confirmation, so a brand-new user's Cat could rewrite their public
    // @handle and bio on the strength of a stray sentence. A public profile is
    // an entity of the user's, not Cat's context: default-off, confirm each
    // time. First use goes through grant-on-confirm like any other entity
    // action — one tap allows it, still confirmed every time.
    category: 'entities',
    icon: Settings,
    riskLevel: 'medium',
    requiresConfirmation: true,
    parameters: [
      {
        name: 'username',
        type: 'string',
        required: false,
        description: 'New @handle (without the @). The old handle keeps resolving.',
      },
      { name: 'name', type: 'string', required: false, description: 'Display name' },
      {
        name: 'bio',
        type: 'string',
        required: false,
        description: 'Short bio (appears on profile)',
      },
      {
        name: 'background',
        type: 'string',
        required: false,
        description: 'Longer background / about section',
      },
      {
        name: 'website',
        type: 'string',
        required: false,
        description: 'Personal or business website URL',
      },
      { name: 'location_city', type: 'string', required: false, description: 'City' },
      {
        name: 'location_country',
        type: 'string',
        required: false,
        description: 'Country (ISO 2-letter code, e.g. CH, US, DE)',
      },
    ],
    examples: [
      'Change my handle to @catomean',
      "Update my bio to say I'm a freelance photographer",
      'Set my location to Zurich, Switzerland',
      'My website is example.com, add it to my profile',
      "Write a background section based on what I've told you",
    ],
    enabled: true,
  },
};

// Categories with metadata
export const ACTION_CATEGORIES: Record<
  ActionCategory,
  { name: string; description: string; icon: LucideIcon }
> = {
  entities: {
    name: 'Entities',
    description: 'Create and manage products, services, projects, causes, and events',
    icon: Package,
  },
  communication: {
    name: 'Communication',
    description: 'Post to timeline and send messages',
    icon: MessageSquare,
  },
  payments: {
    name: 'Payments',
    description: 'Send Bitcoin and fund projects',
    icon: Wallet,
  },
  organization: {
    name: 'Organizations',
    description: 'Create and manage organizations',
    icon: Users,
  },
  context: {
    name: 'Context',
    description: 'Manage what your Cat knows about you',
    icon: FileText,
  },
};

// Export category keys as a tuple for Zod validation (DRY - single source of truth)
export const ACTION_CATEGORY_KEYS = Object.keys(ACTION_CATEGORIES) as [
  ActionCategory,
  ...ActionCategory[],
];

export const RISK_COLORS: Record<ActionRiskLevel, string> = {
  low: 'text-green-600 bg-green-50',
  medium: 'text-amber-600 bg-amber-50',
  high: 'text-red-600 bg-red-50',
};

export const RISK_ICONS: Record<ActionRiskLevel, LucideIcon> = {
  low: ShieldCheck,
  medium: Shield,
  high: ShieldAlert,
};

export default CAT_ACTIONS;
