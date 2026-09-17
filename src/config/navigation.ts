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
import { generateEntityNavigation } from './navigation-generator';
import { ROUTES } from './routes';
import { XBrandIcon, GitHubIcon } from '@/components/icons/BrandIcons';
import {
  Home,
  Plus,
  Compass,
  QrCode,
  Users,
  Settings,
  User as UserIcon,
  MessageSquare,
  BookOpen,
  Globe,
  Info,
  HelpCircle,
  Search,
  Cat,
  ClipboardList,
  BarChart3,
  Handshake,
  CalendarCheck,
  UserPlus,
} from 'lucide-react';
import { ECOSYSTEM_PILLARS } from './ecosystem';

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
 * Header navigation configuration
 *
 * SSOT for the marketing/public header links. This nav is for anonymous
 * visitors only — signed-in users get ONE navigation system (the app
 * sidebar + header actions), never a second marketing nav on top of it.
 */
const headerNavigationConfig = {
  /** Navigation for unauthenticated visitors (marketing surfaces) */
  unauthenticated: [
    {
      name: 'Product',
      children: [
        { name: 'About & mission', href: ROUTES.ABOUT, description: 'Why OrangeCat exists' },
        {
          name: 'Roadmap',
          href: ROUTES.ROADMAP,
          description: 'What works now and what comes next',
        },
        { name: 'Changelog', href: ROUTES.CHANGELOG, description: 'Every shipped improvement' },
        {
          name: 'Docs',
          href: ROUTES.DOCS,
          description: 'Entities, Bitcoin payments, and security',
        },
        {
          name: 'Whitepaper',
          href: ROUTES.WHITEPAPER,
          description: 'The economic coordination thesis',
        },
        {
          name: 'Governance',
          href: ROUTES.GOVERNANCE,
          description: 'Solon-governed platform policies',
        },
        {
          name: 'Pricing',
          href: ROUTES.PRICING,
          description: 'Cat plans — free, BYOK, credits, supporter',
        },
      ],
    },
    { name: 'Blog', href: ROUTES.BLOG },
    { name: 'Support', href: ROUTES.SUPPORT },
    {
      // The sibling products used to sit loose in the top bar, one link each,
      // with nothing saying they belong together. One menu, three pillars —
      // led by the page that explains the stack.
      name: 'Ecosystem',
      children: [
        {
          name: 'The stack',
          href: ROUTES.ECOSYSTEM,
          description: 'One stack, three pillars — and what binds them',
        },
        ...ECOSYSTEM_PILLARS.filter(pillar => !pillar.isSelf).map(pillar => ({
          name: pillar.title,
          href: pillar.siteUrl,
          external: true,
          description: pillar.tagline,
        })),
      ],
    },
  ],
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
 * 1. Main (Home, Timeline, Messages, Explore) - flat, no nesting
 * 2. Create (single section for all creation - collapsed by default)
 * 3. More (Settings, Profile, Help) - collapsed by default
 */

// Generate entity-based navigation as semantic groups instead of one long list.
const entitySections = generateEntityNavigation().map(section =>
  section.id === 'coordinate'
    ? {
        ...section,
        items: [
          ...section.items,
          {
            name: 'People',
            href: ROUTES.DASHBOARD.PEOPLE,
            icon: Users,
            description: 'Find connections',
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
          {
            // Open-roles board. Lives here (not the top header) since the
            // slimmed app header hands all section nav to the sidebar.
            name: 'Collaborate',
            href: ROUTES.COLLABORATE,
            icon: Handshake,
            description: 'Open roles',
            requiresAuth: true,
          },
        ],
      }
    : section
);

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
        icon: Cat,
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
        // Moving money is the defining verb on an economic platform, so it gets
        // ONE primary entry covering both directions — the screens toggle
        // between themselves rather than taking two rows in the sidebar.
        name: 'Money',
        href: ROUTES.RECEIVE,
        icon: QrCode,
        description: 'Get paid or send Bitcoin',
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
        name: 'Messages',
        href: ROUTES.MESSAGES,
        icon: MessageSquare,
        description: 'Private messages',
        requiresAuth: true,
        counter: 'messages',
      },
      {
        name: 'Explore',
        href: ROUTES.DISCOVER,
        icon: Search,
        description: 'Discover',
        requiresAuth: false,
      },
    ],
  },
  ...entitySections,
  {
    id: 'operations',
    title: 'Work',
    priority: 6,
    defaultExpanded: false, // Collapsed by default
    collapsible: true,
    requiresAuth: true,
    items: [
      {
        name: 'Tasks',
        href: ROUTES.DASHBOARD.TASKS,
        icon: ClipboardList,
        description: 'Manage team tasks',
        requiresAuth: true,
      },
      {
        name: 'Analytics',
        href: ROUTES.DASHBOARD.TASKS_ANALYTICS,
        icon: BarChart3,
        description: 'Task analytics',
        requiresAuth: true,
      },
      {
        name: 'Bookings',
        href: ROUTES.DASHBOARD.BOOKINGS,
        icon: CalendarCheck,
        description: 'Service bookings',
        requiresAuth: true,
      },
    ],
  },
  {
    id: 'more',
    title: 'More',
    priority: 7,
    defaultExpanded: false, // Collapsed by default
    collapsible: true,
    requiresAuth: false,
    items: [
      {
        name: 'Profile',
        href: ROUTES.PROFILES.ME,
        icon: UserIcon,
        description: 'Your profile',
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
        name: 'Community',
        href: ROUTES.COMMUNITY,
        icon: Globe,
        description: 'Public feed',
        requiresAuth: false,
      },
      {
        name: 'About',
        href: ROUTES.ABOUT,
        icon: Info,
        description: 'About OrangeCat',
        requiresAuth: false,
      },
      {
        name: 'Help',
        href: ROUTES.FAQ,
        icon: HelpCircle,
        description: 'FAQ & Support',
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
}

export const mobileTabBar: MobileTabItem[] = [
  { name: 'Cat', href: ROUTES.DASHBOARD.CAT, icon: Cat },
  { name: 'Home', href: ROUTES.DASHBOARD.HOME, icon: Home },
  { name: 'Receive', href: ROUTES.RECEIVE, icon: QrCode, primary: true },
  { name: 'Create', href: ROUTES.CREATE, icon: Plus, opensCreate: true },
  { name: 'Messages', href: ROUTES.MESSAGES, icon: MessageSquare, counter: 'messages' },
];

export const mobileTabBarAnonymous: MobileTabItem[] = [
  { name: 'Home', href: ROUTES.HOME, icon: Home },
  { name: 'Explore', href: ROUTES.DISCOVER, icon: Compass },
  { name: 'Create', href: ROUTES.CREATE, icon: Plus, primary: true, opensCreate: true },
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
    { name: 'Discover', href: ROUTES.DISCOVER },
    { name: 'Pay links', href: ROUTES.PAY_LANDING },
    { name: 'How it works', href: ROUTES.HOW_IT_WORKS },
    { name: 'Roadmap', href: ROUTES.ROADMAP },
    { name: 'Changelog', href: ROUTES.CHANGELOG },
    { name: 'Cat plans', href: ROUTES.PRICING },
  ],
  learn: [
    { name: 'Documentation', href: ROUTES.DOCS },
    { name: 'Whitepaper', href: ROUTES.WHITEPAPER },
    { name: 'Blog', href: ROUTES.BLOG },
    { name: 'Bitcoin guide', href: ROUTES.STUDY_BITCOIN },
  ],
  support: [
    { name: 'Ask the Cat', href: ROUTES.FEEDBACK },
    { name: 'Support OrangeCat', href: ROUTES.SUPPORT },
    { name: 'FAQ', href: ROUTES.FAQ },
    { name: 'Status', href: ROUTES.STATUS },
    { name: 'Security', href: ROUTES.SECURITY },
  ],
  ecosystem: [
    { name: 'The stack', href: ROUTES.ECOSYSTEM },
    // Sibling products come from the pillar SSOT, so a fourth pillar (or a
    // moved domain) never has to be remembered here.
    ...ECOSYSTEM_PILLARS.filter(pillar => !pillar.isSelf).map(pillar => ({
      name: pillar.title,
      href: pillar.siteUrl,
      external: true,
    })),
    { name: 'Governance', href: ROUTES.GOVERNANCE },
    { name: 'Community', href: ROUTES.COMMUNITY },
    { name: 'About OrangeCat', href: ROUTES.ABOUT },
  ],
  legal: [
    { name: 'Privacy', href: ROUTES.PRIVACY },
    { name: 'Terms', href: ROUTES.TERMS },
    { name: 'Security', href: ROUTES.SECURITY },
  ],
  social: [
    {
      name: 'X',
      href: 'https://x.com/orangecat',
      icon: XBrandIcon,
    },
    {
      name: 'GitHub',
      href: 'https://github.com/bitbaum/orangecat',
      icon: GitHubIcon,
    },
  ],
  // Compact bottom-bar links (rendered next to the copyright line in
  // <Footer>). Kept in config so adding/removing one is a config-only
  // change. External URLs are marked with `external: true`.
  bottomBar: [
    { name: 'Documentation', href: ROUTES.DOCS },
    { name: 'Source Code', href: 'https://github.com/bitbaum/orangecat', external: true },
    { name: 'Roadmap', href: ROUTES.ROADMAP },
    { name: 'Support', href: ROUTES.SUPPORT },
  ] as { name: string; href: string; external?: boolean }[],
};

/**
 * Authentication navigation items
 */
export const authNavigationItems = [
  { name: 'Sign In', href: `${ROUTES.AUTH}?mode=login` },
  { name: 'Get Started', href: `${ROUTES.AUTH}?mode=register` },
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
} as const;
