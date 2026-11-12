/**
 * Group Field Guidance Content
 *
 * Single source of truth for group creation guidance.
 * Used by GuidancePanel to provide contextual help and examples.
 *
 * Created: 2025-12-30
 * Last Modified: 2025-12-30
 * Last Modified Summary: Initial group guidance content
 */

import React from 'react';
import {
  Users,
  FileText,
  Tag,
  Shield,
  Globe,
  Eye,
  Bitcoin,
  Zap,
  Building2,
  CheckCircle2,
  Target,
} from 'lucide-react';
import type { GuidanceContent, DefaultGuidance } from '@/components/create/types';

type GroupFieldType =
  | 'name'
  | 'description'
  | 'label'
  | 'governance_preset'
  | 'visibility'
  | 'is_public'
  | 'bitcoin_address'
  | 'lightning_address'
  | null;

export const groupGuidanceContent: Record<NonNullable<GroupFieldType>, GuidanceContent> = {
  name: {
    icon: React.createElement(Users, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Group Name',
    description: "Choose a clear, memorable name that represents your group's purpose and values.",
    tips: [
      'Keep it simple and easy to remember',
      'Avoid overly complex or confusing names',
      'Consider your target audience',
      'Make it relevant to your mission',
      'Check if similar names exist',
    ],
    examples: [
      'Ossetia Network State',
      'Bitcoin Builders Guild',
      'Zurich Makerspace',
      'Family Emergency Fund',
      'Swiss Dev Community',
    ],
  },
  description: {
    icon: React.createElement(FileText, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Group Description',
    description: 'Clearly explain what your group does, who it serves, and why it exists.',
    tips: [
      'Start with your mission statement',
      'Explain who benefits from your work',
      'Include what makes you unique',
      'Be specific about your activities',
      'Keep it concise but informative',
    ],
    examples: [
      'Building Bitcoin-powered economic tools for creators and communities worldwide.',
      'Supporting local artisans through fair trade and sustainable practices.',
      'A digital-first nation with shared values, transparent governance, and collective treasury.',
      'Family savings circle for emergency funds and shared expenses.',
    ],
  },
  label: {
    icon: React.createElement(Tag, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Group Label',
    description:
      "Labels help categorize your group and set smart defaults. They don't restrict capabilities - you can enable any features regardless of label.",
    tips: [
      'Circle: Informal groups of trusted people',
      'Network State: Digital-first nation or community',
      'DAO: Decentralized organization with voting',
      'Company: Business organization',
      'Nonprofit: Mission-driven organization',
      'Cooperative: Member-owned organization',
      'Guild: Professional association',
      'Family: Private family group',
    ],
    examples: [
      'Circle - Family savings, friend groups',
      'Network State - Digital communities, virtual nations',
      'DAO - Protocol governance, open-source projects',
      'Company - Startups, businesses',
      'Nonprofit - Charities, foundations',
    ],
  },
  governance_preset: {
    icon: React.createElement(Shield, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Governance Model',
    description: 'Define how decisions are made and how power is distributed in your group.',
    tips: [
      'Consensus: All members must agree (small, trusted groups)',
      'Democratic: Majority vote decides (most communities)',
      'Hierarchical: Clear leadership structure (companies, nonprofits)',
      'You can customize permissions later',
      'Different presets have different default permissions',
    ],
    examples: [
      'Consensus - Family circles, small friend groups',
      'Democratic - Community groups, DAOs, cooperatives',
      'Hierarchical - Companies, nonprofits with boards',
    ],
  },
  visibility: {
    icon: React.createElement(Globe, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Visibility',
    description: "Control who can see your group's content and activities.",
    tips: [
      'Public: Anyone can see group content',
      'Members Only: Only members can see content',
      'Private: Hidden from discovery, invite-only',
      'Visibility affects discoverability',
      'You can change this later',
    ],
    examples: [
      'Public - Open communities, public organizations',
      'Members Only - Professional groups, clubs',
      'Private - Family circles, sensitive groups',
    ],
  },
  is_public: {
    icon: React.createElement(Eye, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Listed in Directory',
    description: 'Show this group in public group listings and search results.',
    tips: [
      'Public groups appear in /groups discovery',
      'Helps others find and join your group',
      'Recommended for open communities',
      'Private groups can still be joined via invite',
      'You can change this later',
    ],
    examples: [
      'Enabled - Open communities, public organizations',
      'Disabled - Private groups, invite-only circles',
    ],
  },
  bitcoin_address: {
    icon: React.createElement(Bitcoin, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Bitcoin Treasury Address',
    description: "Primary Bitcoin address for your group's treasury and financial operations.",
    tips: [
      'For shared control, use a multi-signature wallet your members set up',
      'Generate a fresh address for your group',
      'Consider hardware wallet security',
      'Keep private keys secure and backed up',
      "This will be your group's main treasury",
      'You can add more wallets later',
    ],
    examples: [
      'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlhfe2s (Native SegWit - recommended)',
      'Use multi-sig for groups with shared treasury',
      'Hardware wallet for large amounts',
    ],
  },
  lightning_address: {
    icon: React.createElement(Zap, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Lightning Address',
    description: 'Lightning Network address for instant, low-fee Bitcoin payments.',
    tips: [
      'Optional but recommended for modern payments',
      'Format: yourname@domain.com',
      'Enables instant micro-payments',
      'Lower fees than on-chain transactions',
      'Great for funding and small payments',
      'Can be added later if not ready now',
    ],
    examples: ['ossetia@ln.address', 'guild@lightning.gifts', 'makerspace@zbd.gg'],
  },
};

export const groupDefaultGuidance: DefaultGuidance = {
  title: 'Why Create a Group?',
  description:
    'Groups enable collective action, shared governance, and community building around common goals. From family circles to network states, groups help you coordinate and collaborate.',
  features: [
    {
      icon: React.createElement(Users, { className: 'w-4 h-4 text-fg-primary' }),
      // What a group wallet is: addresses the group controls, readable by its
      // members (group_wallets RLS). OrangeCat holds no keys, so it neither
      // makes nor enforces a multi-signature wallet; a group that wants one
      // brings its own.
      text: "A shared treasury: the group's own Bitcoin and Lightning addresses, shown to its members",
    },
    {
      icon: React.createElement(Shield, { className: 'w-4 h-4 text-fg-primary' }),
      text: 'Democratic governance with voting and proposals',
    },
    {
      icon: React.createElement(Building2, { className: 'w-4 h-4 text-fg-primary' }),
      text: 'Member management and role assignments',
    },
    {
      icon: React.createElement(Target, { className: 'w-4 h-4 text-fg-primary' }),
      text: 'Project affiliation and collective fundraising',
    },
    {
      icon: React.createElement(CheckCircle2, { className: 'w-4 h-4 text-fg-primary' }),
      text: 'Transparent operations and community accountability',
    },
  ],
  hint: '💡 Click on any field to get specific guidance and examples',
};
