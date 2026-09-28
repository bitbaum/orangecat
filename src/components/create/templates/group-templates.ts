/**
 * Group Templates
 *
 * Template definitions for group creation.
 * Provides quick-start templates for common group types.
 *
 * Created: 2025-12-30
 * Last Modified: 2025-12-30
 * Last Modified Summary: Initial group templates
 */

import React from 'react';
import {
  Users,
  Globe,
  Home,
  Building2,
  Heart,
  Briefcase,
  Handshake,
  TrendingUp,
  PiggyBank,
} from 'lucide-react';
import type { EntityTemplate } from '../types';
import type { CreateGroupSchemaType } from '@/services/groups/validation';

export const GROUP_TEMPLATES: EntityTemplate<CreateGroupSchemaType>[] = [
  {
    id: 'network-state',
    icon: React.createElement(Globe, { className: 'w-4 h-4' }),
    name: 'Network State',
    tagline: 'Digital-first nation or community with shared values',
    defaults: {
      name: 'Network State Community',
      description:
        'A digital-first nation with shared values, transparent governance, and collective treasury. Building a sovereign community powered by Bitcoin.',
      label: 'network_state',
      governance_preset: 'democratic',
      is_public: true,
      visibility: 'public',
      bitcoin_address: null,
      lightning_address: null,
    },
  },
  {
    id: 'dao',
    icon: React.createElement(Globe, { className: 'w-4 h-4' }),
    name: 'Decentralized Autonomous Organization',
    tagline: 'On-chain governance and collective decision-making',
    defaults: {
      name: 'Bitcoin Builders DAO',
      description:
        'A decentralized autonomous organization focused on building Bitcoin infrastructure. Members vote on proposals and share in collective treasury management.',
      label: 'dao',
      governance_preset: 'democratic',
      is_public: true,
      visibility: 'public',
      bitcoin_address: null,
      lightning_address: null,
    },
  },
  {
    id: 'family-circle',
    icon: React.createElement(Home, { className: 'w-4 h-4' }),
    name: 'Family Circle',
    tagline: 'Private family group for savings and planning',
    defaults: {
      name: 'Family Savings Circle',
      description:
        'Private family group for emergency savings, shared expenses, and financial planning. Members contribute monthly to a collective Bitcoin treasury.',
      label: 'family',
      governance_preset: 'consensus',
      is_public: false,
      visibility: 'private',
      bitcoin_address: null,
      lightning_address: null,
    },
  },
  {
    id: 'investment-club',
    icon: React.createElement(TrendingUp, { className: 'w-4 h-4' }),
    name: 'Investment Club',
    tagline: 'Collective investment group with shared treasury',
    defaults: {
      name: 'Bitcoin Investment Club',
      description:
        'A collective investment group where members pool Bitcoin for strategic investments. Decisions are made through democratic voting on proposals.',
      label: 'circle',
      governance_preset: 'democratic',
      is_public: false,
      visibility: 'members_only',
      bitcoin_address: null,
      lightning_address: null,
    },
  },
  {
    id: 'community-circle',
    icon: React.createElement(Users, { className: 'w-4 h-4' }),
    name: 'Community Circle',
    tagline: 'Local community group for collaboration',
    defaults: {
      name: 'Local Makerspace',
      description:
        "A local community group for makers, creators, and builders. We share resources, collaborate on projects, and support each other's creative endeavors.",
      label: 'circle',
      governance_preset: 'consensus',
      is_public: true,
      visibility: 'public',
      bitcoin_address: null,
      lightning_address: null,
    },
  },
  {
    id: 'professional-guild',
    icon: React.createElement(Briefcase, { className: 'w-4 h-4' }),
    name: 'Professional Guild',
    tagline: 'Industry association with standards and networking',
    defaults: {
      name: 'Developer Community',
      description:
        'A professional guild for software developers. We set industry standards, share knowledge, and provide networking opportunities.',
      label: 'guild',
      governance_preset: 'hierarchical',
      is_public: true,
      visibility: 'public',
      bitcoin_address: null,
      lightning_address: null,
    },
  },
  {
    id: 'cooperative',
    icon: React.createElement(Handshake, { className: 'w-4 h-4' }),
    name: 'Cooperative',
    tagline: 'Member-owned organization with democratic control',
    defaults: {
      name: 'Artisan Cooperative',
      description:
        'A member-owned cooperative supporting local artisans through fair trade and sustainable practices. Members vote on all major decisions.',
      label: 'cooperative',
      governance_preset: 'democratic',
      is_public: true,
      visibility: 'public',
      bitcoin_address: null,
      lightning_address: null,
    },
  },
  {
    id: 'local-fund',
    icon: React.createElement(PiggyBank, { className: 'w-4 h-4' }),
    name: 'Local fund',
    tagline: 'Money residents direct to their own place, governed by them',
    defaults: {
      name: 'Witikon Fund',
      description:
        'A fund for Witikon, by the people of Witikon. Residents put in what they choose, on top of what the law takes, and decide together what it pays for — the things the quarter wants and the city does not get to.',
      label: 'local_fund',
      governance_preset: 'democratic',
      is_public: true,
      visibility: 'public',
      bitcoin_address: null,
      lightning_address: null,
      country_code: 'CH',
      region: 'Zürich',
      locality: 'Witikon',
    },
  },
  {
    id: 'association',
    icon: React.createElement(Heart, { className: 'w-4 h-4' }),
    name: 'Association',
    tagline: 'A member association: the assembly decides, the statutes bind',
    defaults: {
      name: 'Bitcoin Education Association',
      description:
        'A member association for Bitcoin education. Members meet in assembly, elect the board and vote the budget; the statutes say how. In Switzerland this is a Verein under Art. 60 ZGB.',
      label: 'association',
      governance_preset: 'democratic',
      is_public: true,
      visibility: 'public',
      bitcoin_address: null,
      lightning_address: null,
    },
  },
  {
    id: 'startup-company',
    icon: React.createElement(Building2, { className: 'w-4 h-4' }),
    name: 'Startup Company',
    tagline: 'Early-stage business with structured governance',
    defaults: {
      name: 'Tech Startup',
      description:
        'An early-stage technology startup building innovative tools. We operate with structured governance and clear leadership roles.',
      label: 'company',
      governance_preset: 'hierarchical',
      is_public: false,
      visibility: 'members_only',
      bitcoin_address: null,
      lightning_address: null,
    },
  },
];
