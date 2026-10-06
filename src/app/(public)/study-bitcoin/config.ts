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

export interface LearningPath {
  id: string;
  title: string;
  description: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  /** Only set for available courses — unbuilt content has no honest duration. */
  duration?: string;
  icon: IconComponent;
  color: string;
  bgColor: string;
  /** Only set for available courses — unbuilt content has no honest lesson count. */
  lessons?: number;
  href: string;
  status: 'available' | 'coming-soon';
}

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
    duration: '1-2 hours',
    icon: Wallet,
    color: 'text-bitcoinOrange',
    bgColor: 'bg-bitcoinOrange/5',
    lessons: 5,
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
    href: '/study-bitcoin/basics',
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
    href: '/study-bitcoin/security',
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
    href: '/study-bitcoin/lightning',
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
