import {
  BookOpen,
  Wallet,
  Shield,
  TrendingUp,
  Globe,
  Zap,
  Lightbulb,
  type LucideIcon,
} from 'lucide-react';

type IconComponent = LucideIcon;

interface LearningPathBase {
  id: string;
  title: string;
  description: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  icon: IconComponent;
  color: string;
  bgColor: string;
}

/**
 * A path either exists and has somewhere to go, or is coming soon and has
 * nowhere — so it cannot carry a link. No path states a duration or a lesson
 * count: the one that exists is a single guide page, not a course.
 */
export type LearningPath =
  | (LearningPathBase & { status: 'available'; href: string })
  | (LearningPathBase & { status: 'coming-soon' });

export interface Resource {
  id: string;
  title: string;
  description: string;
  type: 'guide' | 'video' | 'tool' | 'external';
  icon: IconComponent;
  href: string;
  external?: boolean;
  featured?: boolean;
}

export interface Benefit {
  icon: IconComponent;
  title: string;
  description: string;
}

export const LEARNING_PATHS: LearningPath[] = [
  {
    id: 'wallets',
    title: 'Bitcoin Wallets',
    description: 'Learn how to securely store and manage your Bitcoin',
    level: 'Beginner',
    icon: Wallet,
    color: 'text-bitcoinOrange',
    bgColor: 'bg-bitcoinOrange/5',
    href: '/bitcoin-wallet-guide',
    status: 'available',
  },
  {
    id: 'basics',
    title: 'Bitcoin Basics',
    description: 'Start your Bitcoin journey with fundamental concepts',
    level: 'Beginner',
    icon: BookOpen,
    color: 'text-fg-primary',
    bgColor: 'bg-surface-raised/40',
    status: 'coming-soon',
  },
  {
    id: 'security',
    title: 'Security Best Practices',
    description: 'Protect your Bitcoin with advanced security techniques',
    level: 'Intermediate',
    icon: Shield,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    status: 'coming-soon',
  },
  {
    id: 'lightning',
    title: 'Lightning Network',
    description: "Understand Bitcoin's second layer for instant payments",
    level: 'Intermediate',
    icon: Zap,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    status: 'coming-soon',
  },
];

export const QUICK_RESOURCES: Resource[] = [
  {
    id: 'wallet-guide',
    title: 'Bitcoin Wallet Setup Guide',
    description: 'Complete guide to choosing and setting up your first Bitcoin wallet',
    type: 'guide',
    icon: Wallet,
    href: '/bitcoin-wallet-guide',
    featured: true,
  },
  {
    id: 'bitcoin-whitepaper',
    title: 'Bitcoin Whitepaper',
    description: "Read Satoshi Nakamoto's original Bitcoin whitepaper",
    type: 'external',
    icon: BookOpen,
    href: 'https://bitcoin.org/bitcoin.pdf',
    external: true,
  },
  {
    id: 'bitcoin-org',
    title: 'Bitcoin.org',
    description: 'Official Bitcoin information and resources',
    type: 'external',
    icon: Globe,
    href: 'https://bitcoin.org',
    external: true,
  },
  {
    id: 'mempool-explorer',
    title: 'Mempool Explorer',
    description: 'Explore Bitcoin transactions and network statistics',
    type: 'tool',
    icon: TrendingUp,
    href: 'https://mempool.space',
    external: true,
  },
];

export const WHY_LEARN_BENEFITS: Benefit[] = [
  {
    icon: Shield,
    title: 'Financial Sovereignty',
    description: 'Take control of your money without relying on traditional banks',
  },
  {
    icon: Globe,
    title: 'Global Currency',
    description: 'Send money anywhere in the world without borders or restrictions',
  },
  {
    icon: Lightbulb,
    title: 'Future Technology',
    description: 'Stay ahead of the curve in the evolving digital economy',
  },
];
