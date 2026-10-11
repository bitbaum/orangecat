/**
 * Wallet Field Guidance Content
 *
 * Single source of truth for wallet creation & editing guidance.
 * Used by DynamicSidebar to provide contextual help on wallet-related pages.
 *
 * created_date: 2025-11-28
 * last_modified_date: 2025-11-28
 * last_modified_summary: Initial wallet guidance content for DynamicSidebar
 */

import React from 'react';
import {
  Wallet,
  Target,
  FileText,
  KeyRound,
  Shield,
  Coins,
  PiggyBank,
  RefreshCcw,
  Zap,
} from 'lucide-react';
import type { FieldGuidanceContent, DefaultContent } from '@/lib/project-guidance';

export type WalletFieldType =
  | 'category'
  | 'label'
  | 'description'
  | 'lightningAddress'
  | 'addressOrXpub'
  | 'goalAmount'
  | 'goalCurrency'
  | null;

export const walletGuidanceContent: Record<NonNullable<WalletFieldType>, FieldGuidanceContent> = {
  category: {
    icon: React.createElement(Wallet, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Wallet Category',
    description:
      'The category tells supporters what this wallet is for – rent, food, emergencies, projects, and more.',
    tips: [
      'Pick the category that best matches how you will actually use these funds',
      'Use "Rent & Housing" for regular rent or housing costs',
      'Use "General" if this wallet does not have a very specific purpose',
      'You can create multiple wallets for different needs instead of mixing everything into one',
    ],
    examples: [
      'Rent & Housing – monthly apartment rent',
      'Food & Groceries – day to day meals',
      'Emergency Fund – unexpected medical or family emergencies',
    ],
  },
  label: {
    icon: React.createElement(Target, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Wallet Name',
    description:
      'The wallet name is how you and your supporters recognise this wallet. Think of it as the title of a funding bucket.',
    tips: [
      'Make it short, clear, and human – not technical',
      'Include the purpose and, if helpful, how often (e.g. "Monthly Rent – 1200 CHF")',
      'Avoid generic names like "Wallet 1" that do not explain anything',
    ],
    examples: ['Rent – Winter 2025', 'Food & Groceries', 'Medical Bills – Maria'],
  },
  description: {
    icon: React.createElement(FileText, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Description',
    description:
      'Use the description to briefly explain what this wallet is for and why you are collecting funds here.',
    tips: [
      'Explain what problem this wallet helps you solve',
      'Share how often this cost appears (one‑time vs every month)',
      'Keep it friendly and honest – 1–3 short sentences are enough',
    ],
    examples: [
      'This wallet is for my monthly rent so I do not fall behind during studies.',
      'Food and basic groceries while I am between jobs.',
      'Emergency medical costs for ongoing treatment.',
    ],
  },
  lightningAddress: {
    icon: React.createElement(Zap, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Your Lightning Address',
    description:
      'The easiest way to get paid. A Lightning address looks and works like an email address — people send Bitcoin to it instantly, with almost no fee. This is the recommended option for most people.',
    tips: [
      'It looks like an email: name@provider.com',
      "Don't have one yet? Apps like Primal or Coinos give you one for free in about a minute",
      'Payments arrive instantly — great for tips and everyday support',
      'Paste it exactly as your wallet app shows it',
    ],
    examples: ['you@primal.net', 'you@coinos.io'],
  },
  addressOrXpub: {
    icon: React.createElement(KeyRound, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Bitcoin Address or Extended Public Key',
    description:
      'This is where the Bitcoin actually goes: a Bitcoin address from your wallet’s Receive screen. An extended key from your wallet’s settings is the private-er option — each payer gets a fresh address.',
    tips: [
      'Always paste from your wallet app – never type it manually',
      'A single address works, but every payment to it is publicly linked on the blockchain',
      'An extended key gives each payer a fresh address, so payments are not linked to each other',
      'Never paste your recovery seed here – only public addresses or public keys',
    ],
    examples: ['bc1qxy2kg... (a Bitcoin address from your wallet’s Receive screen)'],
  },
  goalAmount: {
    icon: React.createElement(PiggyBank, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Funding Goal (optional)',
    description:
      'The funding goal shows what you are aiming for with this wallet – for example one month of rent or a specific medical bill.',
    tips: [
      'You can leave this empty if you do not want to show a target',
      'If you add a goal, make it realistic and connected to real costs',
      'Supporters understand you better when they see what “fully funded” means',
    ],
    examples: ['1200 CHF for one month of rent', '400 CHF for winter heating costs'],
  },
  goalCurrency: {
    icon: React.createElement(Coins, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Goal Currency',
    description:
      'The currency is only for display – all funding still arrives in Bitcoin, but you can explain your goal in CHF, EUR, USD, or BTC.',
    tips: [
      'Use CHF if your real‑world costs are in Switzerland',
      'Use EUR or USD if that better matches your situation',
      'BTC is useful if you think mainly in Bitcoin',
    ],
    examples: ['1200 CHF rent', '0.01 BTC savings goal', '250 EUR monthly groceries'],
  },
};

export const walletDefaultContent: DefaultContent = {
  title: 'What is a Wallet on OrangeCat?',
  description:
    'A wallet on OrangeCat is how you get paid: a pointer to a Bitcoin wallet you already control. Add several when you want to track separate needs — rent, food, or a savings goal.',
  features: [
    {
      icon: React.createElement(Wallet, { className: 'w-4 h-4 text-fg-primary' }),
      text: 'A Lightning address gets you paid in seconds and switches on your @orangecat.ch address',
    },
    {
      icon: React.createElement(PiggyBank, { className: 'w-4 h-4 text-fg-primary' }),
      text: 'Create separate wallets for rent, food, emergencies, and projects',
    },
    {
      icon: React.createElement(Shield, { className: 'w-4 h-4 text-fg-primary' }),
      text: 'OrangeCat never holds your money — payments go straight to the wallet you choose',
    },
    {
      icon: React.createElement(RefreshCcw, { className: 'w-4 h-4 text-fg-primary' }),
      text: 'Update goals and categories over time as your situation changes',
    },
  ],
  hint: '💡 Click into a field on the left to see focused guidance here.',
};
