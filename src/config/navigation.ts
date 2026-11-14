/**
 * Unified Navigation Configuration
 *
 * Single source of truth for all navigation items across the application
 * Combines header, sidebar, footer, and mobile navigation
 *
 * Entity-based navigation is generated from entity registry (single source of truth).
 * Manual sections for non-entity navigation (Home, Explore, Learn).
 *
 * Progressive disclosure: Only most-used sections expanded by default to reduce clutter.
 *
 * Created: 2025-01-07
 * Last Modified: 2026-07-04
 * Last Modified Summary: Added Circles to Coordinate nav group; Documents, Bookings to sidebar
 */

import { ComponentType, SVGProps } from 'react';
import { BrandMarkIcon } from '@/components/shell/BrandMarkIcon';
import { COMPANION_COPY } from './companions';
import { ROUTES } from './routes';
import { ENTITY_REGISTRY, ENTITY_TYPES } from './entity-registry';
import { XBrandIcon, GitHubIcon } from '@/components/icons/BrandIcons';
import {
  Home,
  Plus,
  Compass,
  Map,
  LayoutGrid,
  Receipt,
  QrCode,
  Users,
  Settings,
  User as UserIcon,
  MessageSquare,
  BookOpen,
  Globe,
  Info,
  HelpCircle,
  Pencil,
  ShoppingBag,
  ClipboardList,
  BarChart3,
  Handshake,
  CalendarCheck,
  UserPlus,
  Landmark,
} from 'lucide-react';
import { ECOSYSTEM, ECOSYSTEM_PILLARS } from './ecosystem';
import { SOURCE_REPO_URL } from './brand';
import { CTA_LABELS } from './landing-page';

/**
 * Counter source identifier for nav items showing a live numeric badge.
 * Mirrors the same union in src/hooks/useNavigation.ts NavItem.counter
 * — kept duplicate-named because NavigationItem (this file) is used by
 * the public/header nav and NavItem (useNavigation) by the sidebar; both
 * agreed surfaces should accept the same set of sources.
 */
export type NavCounterSource = 'messages';

export interface NavigationItem {
  name: string;
  href?: string;
  requiresAuth?: boolean;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  description?: string;
  children?: NavigationItem[]; // For dropdown menus
  external?: boolean; // For external links that open in new tab
  comingSoon?: boolean; // For features not yet available
  counter?: NavCounterSource; // Optional live counter source for badges
  /** Other paths this item owns: it shows active on them as well as on href. */
  activeFor?: readonly string[];
}

export interface NavSection {
  id: string;
  title: string;
  priority: number;
  defaultExpanded?: boolean;
  collapsible?: boolean; // Whether section can be collapsed/expanded
  requiresAuth?: boolean;
  items: NavigationItem[];
}

interface NavItem {
  name: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  description?: string;
  requiresAuth?: boolean;
}

/**
 * The name and one-line description of each public page, keyed by route.
 *
 * The header, the visitor menu and the footer used to label the same routes
 * independently, so one page had several names ("Pricing" in the header,
 * "Cat plans" in the footer; "Docs" and "Documentation"). Every public link is
 * built from this map, so a page is called one thing wherever it is listed.
 */
export const PUBLIC_PAGES = {
  [ROUTES.HOW_IT_WORKS]: {
    name: 'How it works',
    description: 'How people and agents publish and fund work with Bitcoin',
  },
  [ROUTES.WHAT_YOU_CAN_DO]: {
    name: 'What you can do',
    description: 'Everything here, explained',
  },
  [ROUTES.DISCOVER]: {
    name: 'Discover',
    description: 'Explore projects, causes, products and services',
  },
  [ROUTES.PAY_LANDING]: {
    name: 'Get paid',
    description: 'Your own pay page; the money goes to your wallet',
  },
  [ROUTES.BUILDERS]: { name: 'Builders', description: 'Independent builders the studio approves' },
  [ROUTES.PRICING]: {
    name: 'Pricing',
    description: 'Free to sell, 0% fee. Cat plans',
    keywords: 'plans cost price subscription free',
  },
  [ROUTES.BLOG]: { name: 'Blog', description: 'Guides and stories from the build' },
  [ROUTES.ABOUT]: { name: 'About & mission', description: 'Why OrangeCat exists' },
  [ROUTES.ROADMAP]: { name: 'Roadmap', description: 'What works now and what comes next' },
  [ROUTES.CHANGELOG]: { name: 'Changelog', description: 'Every shipped improvement' },
  [ROUTES.DOCS]: {
    name: 'Docs',
    description: 'Entities, Bitcoin payments, and security',
    keywords: 'documentation help guide',
  },
  [ROUTES.WHITEPAPER]: { name: 'Whitepaper', description: 'The economic coordination thesis' },
  [ROUTES.GOVERNANCE]: { name: 'Governance', description: 'Solon-governed platform policies' },
  [ROUTES.SUPPORT]: {
    name: 'Support OrangeCat',
    description: 'Back OrangeCat with Bitcoin',
    keywords: 'fund back contribute',
  },
  [ROUTES.STUDY_BITCOIN]: {
    name: 'Bitcoin guide',
    description: 'Wallets, Lightning Network and self-custody',
  },
  [ROUTES.FEEDBACK]: {
    name: 'Ask the Cat',
    description: 'Ask anything, or tell us what could be better',
  },
  [ROUTES.FAQ]: {
    name: 'FAQ',
    description: 'Frequently asked questions',
    keywords: 'help questions support',
  },
  [ROUTES.STATUS]: { name: 'Status', description: 'Current status of the platform services' },
  [ROUTES.ECOSYSTEM]: {
    name: 'The stack',
    description: 'One stack, three pillars — and what binds them',
  },
  [ROUTES.COMMUNITY]: { name: 'Community', description: 'Public timeline and community posts' },
  [ROUTES.STEAL]: {
    name: 'Steal the cat',
    description: 'MIT-licensed: take the code and own your copy',
  },
  [ROUTES.PRIVACY]: { name: 'Privacy', description: 'How we handle your data' },
  [ROUTES.TERMS]: { name: 'Terms', description: 'Terms of service' },
  [ROUTES.SECURITY]: { name: 'Security', description: 'Security practices and data protection' },
} as const satisfies Record<string, { name: string; description: string; keywords?: string }>;

export type PublicPageRoute = keyof typeof PUBLIC_PAGES;

/** A public page as a navigation link: its one name, its one line, its route. */
export function publicPageLink(route: PublicPageRoute): NavigationItem & { href: string } {
  const page = PUBLIC_PAGES[route];
  return { name: page.name, href: route, description: page.description };
}

/** The sibling products, from the pillar SSOT, as external links. */
const ecosystemPillarLinks: Array<NavigationItem & { href: string; external: true }> =
  ECOSYSTEM_PILLARS.filter(pillar => !pillar.isSelf).map(pillar => ({
    name: pillar.title,
    href: pillar.siteUrl,
    external: true,
    description: pillar.tagline,
  }));

/**
 * Header navigation configuration
 *
 * SSOT for the marketing/public header links. This nav is for anonymous
 * visitors only — signed-in users get ONE navigation system (the app
 * sidebar + header actions), never a second marketing nav on top of it.
 *
 * "Product" is what the product does; "About" is the company and its record.
 * They used to be one menu called Product, and a top-level "Support" pointed
 * at the page where people fund OrangeCat — not where they get help.
 */
const headerNavigationConfig = {
  /** Navigation for unauthenticated visitors (marketing surfaces) */
  unauthenticated: [
    {
      name: 'Product',
      children: [
        publicPageLink(ROUTES.HOW_IT_WORKS),
        publicPageLink(ROUTES.WHAT_YOU_CAN_DO),
        publicPageLink(ROUTES.DISCOVER),
        publicPageLink(ROUTES.PAY_LANDING),
      ],
    },
    publicPageLink(ROUTES.PRICING),
    publicPageLink(ROUTES.BLOG),
    {
      name: 'About',
      children: [
        publicPageLink(ROUTES.ABOUT),
        publicPageLink(ROUTES.ROADMAP),
        publicPageLink(ROUTES.CHANGELOG),
        publicPageLink(ROUTES.DOCS),
        publicPageLink(ROUTES.WHITEPAPER),
        publicPageLink(ROUTES.GOVERNANCE),
        publicPageLink(ROUTES.SUPPORT),
      ],
    },
    {
      // The sibling products used to sit loose in the top bar, one link each,
      // with nothing saying they belong together. One menu, three pillars —
      // led by the page that explains the stack.
      name: 'Ecosystem',
      children: [publicPageLink(ROUTES.ECOSYSTEM), ...ecosystemPillarLinks],
    },
  ] satisfies NavigationItem[],
};

/**
 * Get the marketing header navigation items (anonymous visitors only).
 * Signed-in users never see this nav — their navigation lives in the
 * app sidebar and the header action cluster.
 */
export function getHeaderNavigationItems(): NavigationItem[] {
  return [...headerNavigationConfig.unauthenticated];
}

/**
 * Sidebar navigation sections for authenticated users
 *
 * SIMPLIFIED X/Twitter-style navigation:
 * - 4-5 main sections only
 * - Progressive disclosure via single "Create" button
 * - Less cognitive load, faster navigation
 *
 * Structure:
 * 1. Main (Cat, Home, Discover, My things, Money, Messages, the map) - flat
 * 2. Create (single section for all creation - collapsed by default)
 * 3. More (Settings, Profile, Help) - collapsed by default
 */

/** The money screens toggle between themselves; one nav item owns all three. */
const MONEY_PATHS: readonly string[] = [ROUTES.RECEIVE, ROUTES.SEND, ROUTES.REQUESTS];

/**
 * The four entity sections the sidebar used to carry (Create · Fund ·
 * Coordinate · Finance — fifteen nouns behind four chevrons) are gone. One
 * page, "My things", lists everything the person made or joined, and the map
 * ("What you can do") explains every type in plain words. What remains here is
 * the handful of destinations that are about PEOPLE rather than things.
 */
const peopleSection: NavSection = {
  id: 'people',
  title: 'People',
  priority: 2,
  defaultExpanded: false,
  collapsible: true,
  requiresAuth: true,
  items: [
    {
      name: 'People',
      href: ROUTES.DASHBOARD.PEOPLE,
      icon: Users,
      description: 'Find connections',
      requiresAuth: true,
    },
    {
      name: 'Timeline',
      href: ROUTES.TIMELINE,
      icon: BookOpen,
      description: 'Your feed',
      requiresAuth: true,
    },
    {
      name: 'Community',
      href: ROUTES.COMMUNITY,
      icon: Globe,
      description: 'Public feed',
      requiresAuth: false,
    },
    {
      name: 'Collaborate',
      href: ROUTES.COLLABORATE,
      icon: Handshake,
      description: 'Open roles',
      requiresAuth: true,
    },
    {
      // The claims dashboard shipped complete on 2026-08-18 — table,
      // API, dashboard, and a public /claim/<id> landing page — and had
      // written zero rows by 2026-09-05, because nothing in this file
      // pointed at it. The only way in was typing the URL.
      name: 'Set up for someone',
      href: ROUTES.DASHBOARD.PROFILE_CLAIMS,
      icon: UserPlus,
      description: 'Create a profile for someone who has not joined yet',
      requiresAuth: true,
    },
  ],
};

/**
 * Money and work: what you earned, owe and traded, and the work that brings
 * it in. One word per place, the same word its page uses ("Finances", not
 * "Your money"), and no icon shared with another row (Deals used to wear
 * Collaborate's handshake).
 */
const moneyAndWorkSection: NavSection = {
  id: 'operations',
  title: 'Money and work',
  priority: 6,
  defaultExpanded: false,
  collapsible: true,
  requiresAuth: true,
  items: [
    {
      name: 'Finances',
      href: ROUTES.DASHBOARD.FINANCES,
      icon: Receipt,
      description: 'Income, debts, civic split, tax estimate',
      requiresAuth: true,
    },
    {
      name: 'Deals',
      href: ROUTES.DASHBOARD.DEALS,
      icon: ShoppingBag,
      description: 'What you bought and sold, and reviewing the other side',
      requiresAuth: true,
    },
    {
      // "Of the money you owe the public, how would you divide it?" —
      // a person's declared split between locality, region and nation.
      name: 'Civic split',
      href: ROUTES.DASHBOARD.CIVIC_SPLIT,
      icon: Landmark,
      description: 'Say where your public money should go',
      requiresAuth: true,
    },
    {
      name: 'Tasks',
      href: ROUTES.DASHBOARD.TASKS,
      icon: ClipboardList,
      description: 'Manage team tasks',
      requiresAuth: true,
    },
    {
      name: 'Bookings',
      href: ROUTES.DASHBOARD.BOOKINGS,
      icon: CalendarCheck,
      description: 'Service bookings',
      requiresAuth: true,
    },
    {
      name: 'Analytics',
      href: ROUTES.DASHBOARD.TASKS_ANALYTICS,
      icon: BarChart3,
      description: 'Task analytics',
      requiresAuth: true,
    },
  ],
};

/**
 * The places under "you" — your page, your profile, settings, help. They live
 * in the account menu (the avatar), not in the sidebar: listing them in both
 * gave one place two names and two icons. The palette reads them from here.
 */
export const accountNavItems: NavigationItem[] = [
  {
    name: 'Your page',
    href: ROUTES.PROFILE.SELF,
    icon: UserIcon,
    description: 'Your profile, as others see it',
    requiresAuth: true,
  },
  {
    name: 'Edit profile',
    href: ROUTES.DASHBOARD.INFO_EDIT,
    icon: Pencil,
    description: 'Name, photo, bio and links',
    requiresAuth: true,
  },
  {
    name: 'Settings',
    href: ROUTES.SETTINGS,
    icon: Settings,
    description: 'Preferences',
    requiresAuth: true,
  },
  {
    name: 'Help',
    href: ROUTES.FAQ,
    icon: HelpCircle,
    description: 'FAQ & Support',
    requiresAuth: false,
  },
];

// Simplified main navigation - X/Twitter style
const simplifiedSections: NavSection[] = [
  {
    id: 'main',
    title: '', // No title - these are primary nav items
    priority: 1,
    defaultExpanded: true,
    collapsible: false, // Primary nav is always visible
    requiresAuth: false,
    items: [
      {
        name: 'Cat',
        href: ROUTES.DASHBOARD.CAT,
        icon: BrandMarkIcon,
        description: 'Your AI agent',
        requiresAuth: true,
      },
      {
        name: 'Home',
        href: ROUTES.DASHBOARD.HOME,
        icon: Home,
        description: 'Your dashboard',
        requiresAuth: true,
      },
      {
        // The shelf where makers are found. It used to sit under "More", next
        // to About: two clicks away, and with its group collapsed nothing in
        // the sidebar lit up on /discover. Top level, so it is one tap and
        // always shows where you are. The phone tab bar is full (five slots,
        // and Create is the only way to create below the header's sm
        // breakpoint), so on a phone Discover is the drawer's top level.
        // Named after its page, with the compass the visitor tab bar uses.
        name: PUBLIC_PAGES[ROUTES.DISCOVER].name,
        href: ROUTES.DISCOVER,
        icon: Compass,
        description: 'Find people and projects',
        requiresAuth: false,
      },
      {
        // Everything the person made or joined, one list. Replaces the four
        // collapsed entity sections that used to sit under Home.
        name: 'My things',
        href: ROUTES.DASHBOARD.THINGS,
        icon: LayoutGrid,
        description: 'Everything you made or joined',
        requiresAuth: true,
        // Each type's own list belongs to My things: without this, opening
        // your products left every row in the sidebar dark.
        activeFor: ENTITY_TYPES.map(type => ENTITY_REGISTRY[type].basePath),
      },
      {
        // Moving money is the defining verb on an economic platform, so it gets
        // ONE primary entry covering both directions — the screens toggle
        // between themselves rather than taking two rows in the sidebar.
        name: 'Money',
        href: ROUTES.RECEIVE,
        icon: QrCode,
        description: 'Get paid or send Bitcoin',
        requiresAuth: true,
        activeFor: MONEY_PATHS,
      },
      {
        // Stays primary: it carries the unread counter and holds a slot in the
        // mobile tab bar, which must agree with this list.
        name: 'Messages',
        href: ROUTES.MESSAGES,
        icon: MessageSquare,
        description: 'Private messages',
        requiresAuth: true,
        counter: 'messages',
      },
      {
        // The map. Every capability in plain words with a Start button — the
        // answer to "what can I even do here?", reachable from every screen.
        name: 'What you can do',
        href: ROUTES.WHAT_YOU_CAN_DO,
        icon: Map,
        description: 'Everything here, explained',
        requiresAuth: false,
      },
    ],
  },
  peopleSection,
  moneyAndWorkSection,
  {
    // Three rows, not ten: Profile, Settings and Help moved to the account
    // menu; Timeline and Community to People; Finances and Deals to Money and
    // work.
    id: 'more',
    title: 'More',
    priority: 7,
    defaultExpanded: false, // Collapsed by default
    collapsible: true,
    requiresAuth: false,
    items: [
      {
        name: COMPANION_COPY.talk.title,
        href: ROUTES.AI_ASSISTANTS.TALK,
        icon: ENTITY_REGISTRY['ai_assistant'].icon,
        description: 'The Cat, the fleet’s specialists and your own bots, one list',
        requiresAuth: true,
      },
      {
        name: 'About',
        href: ROUTES.ABOUT,
        icon: Info,
        description: 'About OrangeCat',
        requiresAuth: false,
      },
    ],
  },
];

// Export simplified sections
export const sidebarSections: NavSection[] = simplifiedSections;

/**
 * Mobile tab bar — the five slots in the thumb zone.
 *
 * This used to be a hardcoded array inside MobileBottomNav, which is how the
 * phone and the desktop sidebar drifted into disagreeing (the bar sent
 * "Profile" to the edit form while the sidebar sent it to the public page, and
 * the primary money surface was absent from the bar entirely). One list, one
 * decision about what deserves a thumb.
 *
 * Chosen by frequency × value on an economic platform. Receive holds the
 * primary slot because moving money is the defining act here and it previously
 * had no presence on mobile at all; Create keeps a slot but not the emphasis,
 * since creating an entity is deliberate and occasional. Timeline and Profile
 * come out — Timeline lives in the drawer, Profile in the header avatar, and
 * both were spending prime space on destinations reachable elsewhere.
 */
export interface MobileTabItem {
  name: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** The raised, visually dominant slot. Exactly one item may set this. */
  primary?: boolean;
  /** Opens the contextual create surface rather than navigating to `href`. */
  opensCreate?: boolean;
  counter?: NavCounterSource;
  /** Other paths this slot owns: it shows active on them as well as on href. */
  activeFor?: readonly string[];
}

export const mobileTabBar: MobileTabItem[] = [
  { name: 'Cat', href: ROUTES.DASHBOARD.CAT, icon: BrandMarkIcon },
  { name: 'Home', href: ROUTES.DASHBOARD.HOME, icon: Home },
  // Same name as the sidebar's entry: one destination, one word.
  { name: 'Money', href: ROUTES.RECEIVE, icon: QrCode, primary: true, activeFor: MONEY_PATHS },
  { name: 'Create', href: ROUTES.CREATE, icon: Plus, opensCreate: true },
  { name: 'Messages', href: ROUTES.MESSAGES, icon: MessageSquare, counter: 'messages' },
];

/**
 * A visitor's bar: places to look, and the way in. Creating needs an account,
 * so a raised Create slot here was the loudest control on Discover and led
 * straight to the sign-in form. No slot is raised.
 */
export const mobileTabBarAnonymous: MobileTabItem[] = [
  { name: 'Home', href: ROUTES.HOME, icon: Home },
  // Same word as the page it opens and the signed-in sidebar: one place, one name.
  { name: PUBLIC_PAGES[ROUTES.DISCOVER].name, href: ROUTES.DISCOVER, icon: Compass },
  { name: PUBLIC_PAGES[ROUTES.HOW_IT_WORKS].name, href: ROUTES.HOW_IT_WORKS, icon: Info },
  { name: 'Sign in', href: ROUTES.AUTH, icon: UserIcon },
];

/**
 * Bottom navigation items for account management
 *
 * These appear at the bottom of the sidebar
 * Note: Profile and Settings are already in the "More" section above,
 * so this array is kept empty to avoid duplicate navigation items.
 */
export const bottomNavItems: NavItem[] = [];

/**
 * Footer navigation configuration
 */
export const footerNavigation = {
  product: [
    publicPageLink(ROUTES.DISCOVER),
    publicPageLink(ROUTES.PAY_LANDING),
    publicPageLink(ROUTES.HOW_IT_WORKS),
    publicPageLink(ROUTES.WHAT_YOU_CAN_DO),
    // /builders only redirects to bitbaum; say so in the link itself.
    { ...publicPageLink(ROUTES.BUILDERS), href: ECOSYSTEM.studio.buildersUrl, external: true },
    publicPageLink(ROUTES.ROADMAP),
    publicPageLink(ROUTES.CHANGELOG),
    publicPageLink(ROUTES.PRICING),
  ],
  learn: [
    publicPageLink(ROUTES.DOCS),
    publicPageLink(ROUTES.WHITEPAPER),
    publicPageLink(ROUTES.BLOG),
    publicPageLink(ROUTES.STUDY_BITCOIN),
  ],
  support: [
    publicPageLink(ROUTES.FEEDBACK),
    publicPageLink(ROUTES.SUPPORT),
    publicPageLink(ROUTES.FAQ),
    publicPageLink(ROUTES.STATUS),
  ],
  ecosystem: [
    publicPageLink(ROUTES.ECOSYSTEM),
    // Sibling products come from the pillar SSOT, so a fourth pillar (or a
    // moved domain) never has to be remembered here.
    ...ecosystemPillarLinks,
    publicPageLink(ROUTES.GOVERNANCE),
    publicPageLink(ROUTES.COMMUNITY),
    publicPageLink(ROUTES.ABOUT),
    publicPageLink(ROUTES.STEAL),
  ],
  legal: [
    publicPageLink(ROUTES.PRIVACY),
    publicPageLink(ROUTES.TERMS),
    publicPageLink(ROUTES.SECURITY),
  ],
  social: [
    {
      name: 'X',
      href: 'https://x.com/orangecat',
      icon: XBrandIcon,
    },
    {
      name: 'GitHub',
      href: SOURCE_REPO_URL,
      icon: GitHubIcon,
    },
  ],
};

/**
 * Authentication navigation items
 */
export const authNavigationItems = [
  { name: 'Sign In', href: `${ROUTES.AUTH}?mode=login` },
  { name: CTA_LABELS.primaryAction, href: ROUTES.AUTH_REGISTER },
];

/**
 * Navigation labels for accessibility and internationalization
 */
export const navigationLabels = {
  MAIN_NAVIGATION: 'Main navigation',
  SECTION_TOGGLE: 'Toggle section',
  COMING_SOON: 'Coming soon',
  SIDEBAR_EXPAND: 'Expand sidebar',
  SIDEBAR_COLLAPSE: 'Collapse sidebar',
  SIDEBAR_MORE: 'More',
} as const;
