/**
 * Landing Page Configuration - Single Source of Truth
 *
 * All content for public landing pages is defined here.
 * Components import from this file to ensure consistency.
 *
 * BENEFITS:
 * - Easy to update copy without touching components
 * - Consistent messaging across pages
 * - Non-engineers can update content
 * - Follows SSOT principle from CLAUDE.md
 *
 * Created: 2026-01-28
 * Last updated: 2026-09-13 — Creation is now a first-class verb. The platform
 * did not only start LISTING work, it started MAKING it (the Studio: video,
 * music, writing, artwork), and the copy said nothing about that. Every surface
 * below now carries the same three moves in the same order: make it, finance
 * it, get paid.
 */

import {
  LucideIcon,
  Globe,
  Package,
  Lock,
  Wallet,
  Scale,
  Coins,
  Cat,
  TrendingUp,
  Bot,
  Clapperboard,
} from 'lucide-react';
import { GRADIENTS } from '@/config/gradients';

// ==================== SUPER-APP CATEGORIES ====================

/**
 * Main categories shown on landing page
 * Reflects the full economic spectrum: creation, exchange, funding,
 * coordination, AI agent
 */
interface SuperAppCategory {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  iconGradient: string;
  bgColor: string;
  features: {
    title: string;
    description: string;
  }[];
}

export const SUPER_APP_CATEGORIES: SuperAppCategory[] = [
  {
    id: 'create',
    title: 'Make the Work',
    description: 'The thing itself, not just the listing',
    icon: Clapperboard,
    iconGradient: GRADIENTS.iconOrange,
    bgColor: 'bg-surface-raised',
    features: [
      {
        title: 'Studio',
        description:
          'Video, music, writing and artwork — describe it, then change it by saying what is wrong with it. No craft vocabulary required.',
      },
      {
        title: 'Then finance or sell it',
        description:
          'Unfinished work becomes a project people fund. Finished work becomes a product people buy.',
      },
    ],
  },
  {
    id: 'exchange',
    title: 'Exchange',
    description: 'Buy and sell with anyone',
    icon: Package,
    iconGradient: GRADIENTS.iconBlue,
    bgColor: 'bg-surface-raised',
    features: [
      { title: 'Products', description: 'Sell physical or digital goods to anyone, anywhere' },
      { title: 'Services', description: 'Offer your expertise — hourly, fixed, or on your terms' },
    ],
  },
  {
    id: 'finance',
    title: 'Fund & Finance',
    description: 'From gifts to investments',
    icon: Coins,
    iconGradient: GRADIENTS.iconOrange,
    bgColor: 'bg-surface-raised',
    features: [
      {
        title: 'Fund Projects & Causes',
        description:
          'From no-strings gifts to milestone-based backing — all funding forms supported',
      },
      {
        title: 'Loans & Investments',
        description: 'Peer-to-peer lending and equity-style investing without intermediaries',
      },
    ],
  },
  {
    id: 'coordination',
    title: 'Coordinate Together',
    description: 'Organize people, money, and decisions',
    icon: Scale,
    iconGradient: GRADIENTS.iconTiffany,
    bgColor: 'bg-surface-raised',
    features: [
      { title: 'Groups', description: 'Shared treasuries, roles, and collective decisions' },
      {
        title: 'Circles & Events',
        description: 'Lighter communities and time-bound coordination',
      },
    ],
  },
  {
    id: 'ai',
    title: 'Your Cat',
    description: 'An AI agent that acts on your behalf',
    icon: Bot,
    iconGradient: GRADIENTS.iconTiffany,
    bgColor: 'bg-surface-raised',
    features: [
      {
        title: 'Cat',
        description:
          'Your personal AI economic agent — sets up entities, manages activity, and acts on your behalf.',
      },
      {
        title: 'AI Assistants',
        description:
          'Deploy AI agents for your group or project. They can earn, spend, and coordinate — within owner-approved limits.',
      },
    ],
  },
];

// ==================== HOW IT WORKS STEPS ====================

/**
 * Unified 5-step process — Cat-centric flow, with making the work as its own
 * step. The how-it-works page derives its heading from this array's length, so
 * adding a step here cannot leave a page claiming "4 simple steps".
 */
interface HowItWorksStep {
  number: string;
  icon: LucideIcon;
  title: string;
  description: string;
  iconGradient: string;
  bgColor: string;
}

export const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    number: '1',
    icon: Lock,
    title: 'Choose Your Identity',
    description: 'Use your real name, a handle, or anything in between. Your identity, your rules.',
    iconGradient: GRADIENTS.iconTiffany,
    bgColor: 'bg-surface-raised',
  },
  {
    number: '2',
    icon: Cat,
    title: 'Meet Your Cat',
    description:
      'Your AI economic agent is ready. Tell it what you want to do — sell, fund, lend, invest, or coordinate.',
    iconGradient: GRADIENTS.iconTiffany,
    bgColor: 'bg-surface-raised',
  },
  {
    number: '3',
    icon: Clapperboard,
    title: 'Make It',
    description:
      'Use the Studio for video, music, writing or artwork, or bring work you already have. Change it by saying what to change — plain words, no craft vocabulary.',
    iconGradient: GRADIENTS.iconOrange,
    bgColor: 'bg-surface-raised',
  },
  {
    number: '4',
    icon: Wallet,
    title: 'Pick Your Currency',
    description:
      'Price your work in any display currency. Payments settle natively in Bitcoin and Lightning: global, non-custodial, and independently verifiable.',
    iconGradient: GRADIENTS.iconOrange,
    bgColor: 'bg-surface-raised',
  },
  {
    number: '5',
    icon: TrendingUp,
    title: 'Finance It, Get Paid',
    description:
      'Unfinished work raises money as a project. Finished work sells as a product. Lend, invest and coordinate from the same place. Your Cat keeps track and acts on your behalf.',
    iconGradient: GRADIENTS.iconGreen,
    bgColor: 'bg-surface-raised',
  },
];

// ==================== FEE CLAIMS — SSOT for "0% / 100%" language ====================

/**
 * Fee-related marketing claims. These were previously hardcoded in 5+
 * places (HeroSectionStatic, events/page.tsx, how-it-works, technology,
 * inline `0% fees` badges). Keeping them here means one edit covers every
 * surface the moment the claim stops being true — and prevents drift like
 * "100% to creator" on one page and "100% reaches the recipient" on another.
 */
export const FEE_CLAIMS = {
  platformFee: '0%',
  creatorShare: '100%',
  feeBadgeLabel: '0% fees',
  feeStatTopLabel: 'Platform Fees',
  feeStatBottomLabel: 'To Creator',
  // Use for body copy where you previously said "100% reaches the recipient"
  passthroughClaim: '100% reaches the recipient — no middleman, no processing costs.',
} as const;

// ==================== PLATFORM COMPARISON ====================

/**
 * Comparison between traditional platforms and OrangeCat
 * Used in TrustSection
 */
interface ComparisonRow {
  feature: string;
  traditional: string;
  orangecat: string;
  highlight?: boolean;
}

export const PLATFORM_COMPARISON: ComparisonRow[] = [
  {
    feature: 'Identity',
    traditional: 'Real name + documents',
    orangecat: 'Your name, your rules',
    highlight: true,
  },
  {
    feature: 'Payment methods',
    traditional: 'One currency, their rules',
    orangecat: 'Bitcoin and Lightning settlement',
    highlight: true,
  },
  {
    feature: 'Making the work',
    traditional: 'Bring a finished file',
    orangecat: 'Studio: video, music, writing, artwork',
    highlight: true,
  },
  { feature: 'Platform fees', traditional: '5–10%', orangecat: '0%' },
  { feature: 'AI agent', traditional: 'None', orangecat: 'Your Cat acts on your behalf' },
  { feature: 'Account freezing', traditional: 'Can happen anytime', orangecat: 'Impossible' },
  { feature: 'Geographic reach', traditional: 'Limited', orangecat: 'Global, no restrictions' },
  {
    feature: 'Funds control',
    traditional: 'Platform holds your money',
    orangecat: 'Direct to your wallet',
  },
];

// ==================== PLATFORM BENEFITS ====================

/**
 * Key benefits of using OrangeCat
 */
interface PlatformBenefit {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const PLATFORM_BENEFITS: PlatformBenefit[] = [
  {
    icon: Clapperboard,
    title: 'Make It Here',
    description:
      'The Studio renders video, music, writing and artwork. You change it by saying what is wrong with it — not by learning the craft first.',
  },
  {
    icon: Cat,
    title: 'Your AI Cat',
    description:
      'Cat is your personal economic agent. It sets up entities, manages activity, and acts on your behalf.',
  },
  {
    icon: Globe,
    title: 'No Gatekeepers',
    description:
      'No middlemen, no verification walls, no account freezing. Economic participation as open as speech.',
  },
  {
    icon: Wallet,
    title: 'Bitcoin First',
    description:
      'Lightning and on-chain Bitcoin are the live payment rails. Other rails remain roadmap research.',
  },
  {
    icon: Lock,
    title: 'Any Identity',
    description:
      'Any person or organization can participate fully. Use any name — your identity is yours to define.',
  },
];

// ==================== EXAMPLE USE CASES ====================

/**
 * Example use cases — clearly labeled as examples, not real testimonials
 */
interface ExampleUseCase {
  emoji: string;
  category: string;
  title: string;
  description: string;
  transparencyExample: string;
  gradient: string;
}

export const EXAMPLE_USE_CASES: ExampleUseCase[] = [
  {
    emoji: '🎬',
    category: 'Creator',
    title: 'Make It, Then Fund It',
    description:
      'Write the novel, cut the film, record the record — in the Studio or your own tools. Raise the money to finish it as a project, sell it as a product when it is done.',
    transparencyExample:
      'Backers can see every version as it changes. Share receipts and progress publicly, or keep it private. Your choice.',
    gradient: 'bg-surface-base',
  },
  {
    emoji: '🎧',
    category: 'Musician',
    title: 'You Do Not Have to Read Music',
    description:
      'Describe how it should feel, listen, and say what to change — "the middle drags", "warmer". Everyone is a listener even when they are not a musician.',
    transparencyExample:
      'Sell the finished record directly. Bitcoin settles to your wallet; nobody holds your masters.',
    gradient: 'bg-surface-base',
  },
  {
    emoji: '🚀',
    category: 'Entrepreneur',
    title: 'Build Without Permission',
    description:
      'Launch products, offer services, and raise funding — no platform approval, no geography limits, no identity requirements.',
    transparencyExample:
      'Your Cat helps you set up your store, manage pricing, and track payments automatically.',
    gradient: 'bg-surface-base',
  },
  {
    emoji: '🔬',
    category: 'Research',
    title: 'Decentralized Science',
    description:
      'Fund equipment, studies, and publications with direct Bitcoin and Lightning support.',
    transparencyExample: 'Publish findings, share lab updates, build scientific credibility.',
    gradient: 'bg-surface-base',
  },
  {
    emoji: '🏛️',
    category: 'Community',
    title: 'Coordinate Together',
    description:
      'Organize shared treasuries, collective decisions, and community activity — with or without revealing identities.',
    transparencyExample:
      'Groups have their own Cat. It manages the treasury and executes collective decisions.',
    gradient: 'bg-surface-base',
  },
];

// ==================== TRUST SIGNALS ====================

/**
 * Trust indicators shown at bottom of sections
 */
export const TRUST_SIGNALS = [
  'Make video, music and writing here',
  'Zero platform fees',
  'Bitcoin and Lightning payments',
  'No account freezing',
  'Open source',
] as const;

// ==================== CTA COPY ====================

/**
 * Consistent CTA labels across the site
 */
export const CTA_LABELS = {
  primaryAction: 'Meet your Cat',
  secondaryAction: 'Discover',
  discoverAction: 'Discover',
  createAccount: 'Create Free Account',
  startCreating: 'Meet your Cat',
  viewProject: 'View Project',
  learnMore: 'How it works',
  browseAll: 'Browse All',
} as const;

/** First-fold copy. One sentence, then the two actions. */
export const HERO_COPY = {
  badgeLead: 'Your AI economic agent',
  badgeIdentity: 'Any identity',
  headline: 'Make it. Finance it. Get paid.',
  lede: 'A film, a record, a novel, a product, a service — make it here, raise the money to finish it, and sell it. Your Cat does the setup. Bitcoin settles. Any name you like.',
  /**
   * The three lines inside the hero's demo card. Here rather than in the
   * component because they are the shortest statement of what the platform
   * does, and they were drifting from the headline above them.
   */
  demoFeatures: [
    'Makes the work with you — video, music, writing, artwork',
    'Sets up the funding and the listing',
    'Paid in Bitcoin, non-custodial',
  ],
  /** Chips under the demo card's CTA. */
  demoTags: ['Studio built in', 'Proactive agent', 'Non-custodial'],
} as const;

/**
 * The first moves a visitor can take. Everything else on the old homepage
 * (category grid, example personas, step-by-step explainer, comparison table)
 * lives on /how-it-works, /studio or /discover.
 *
 * "Make something" leads because it is the move nobody expects a funding
 * platform to offer, and because it is the one that needs no account, no
 * audience and no idea of what to sell yet.
 */
export const FIRST_MOVES = [
  {
    id: 'studio',
    title: 'Make something',
    body: 'Video, music, writing, artwork. Describe it, then change it by saying what is wrong.',
    href: '/studio',
    cta: 'See the Studio',
  },
  {
    id: 'cat',
    title: 'Meet your Cat',
    body: 'It interviews you and sets up offerings from what you already have.',
    href: '/auth',
    cta: 'Start',
  },
  {
    id: 'discover',
    title: 'See what exists',
    body: 'Real projects, products, and people already settling in Bitcoin.',
    href: '/discover',
    cta: 'Discover',
  },
  {
    id: 'learn',
    title: 'How it works',
    body: 'Five short steps if you want the picture before you start.',
    href: '/how-it-works',
    cta: 'Read',
  },
] as const;

// ==================== SECTION HEADERS ====================

/**
 * Consistent section headers
 */
export const SECTION_HEADERS = {
  whatCanYouDo: {
    title: 'Everyone Can Make Things',
    subtitle:
      'Films, records, novels, artwork — and products, services, projects, causes, events, loans and investments. Make the work here, finance it here, get paid here, under any identity, settled in Bitcoin.',
  },
  howItWorks: {
    title: 'Meet Your Cat',
    subtitle:
      'Your AI economic agent helps you make the work, finds the money for it, and sets everything up. You decide what to pursue.',
  },
  exampleUseCases: {
    title: 'Built for Makers',
    subtitle:
      'Any person, pseudonym, or organization can make something and be paid for it. Here are some examples.',
  },
  transparency: {
    title: 'Private Where It Matters, Transparent Where You Choose',
    subtitle:
      'Private messaging (E2E encryption planned). On-chain Bitcoin transparency when you want it. Your data, your rules.',
  },
  whyBitcoin: {
    title: 'Why OrangeCat?',
    subtitle:
      'Traditional platforms gatekeep, freeze accounts, and force identity. OrangeCat removes all of that.',
  },
} as const;
