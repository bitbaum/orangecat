/**
 * AI Assistant Field Guidance Content
 *
 * Single source of truth for AI assistant creation guidance.
 * Used by DynamicSidebar to provide contextual help.
 *
 * Created: 2025-12-25
 * Last Modified: 2025-12-25
 * Last Modified Summary: Initial AI assistant guidance content
 */

import { ENTITY_REGISTRY } from '@/config/entity-registry';
import React from 'react';
import { Bot, FileText, Cpu, Zap, DollarSign, MessageSquare, CheckCircle2 } from 'lucide-react';
import type { GuidanceContent, DefaultGuidance } from '@/components/create/types';

export type AIAssistantFieldType =
  | 'title'
  | 'description'
  | 'category'
  | 'system_prompt'
  | 'welcome_message'
  | 'model_preference'
  | 'temperature'
  | 'max_tokens_per_response'
  | 'compute_provider_type'
  | 'pricing_model'
  | 'price_per_message'
  | 'price_per_1k_tokens'
  | 'subscription_price'
  | 'free_messages_per_day'
  | 'lightning_address'
  | 'bitcoin_address'
  | null;

export const aiAssistantGuidanceContent: Record<
  NonNullable<AIAssistantFieldType>,
  GuidanceContent
> = {
  title: {
    icon: React.createElement(Bot, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Assistant Name',
    description:
      'Choose a descriptive name that tells users what your AI does. Good names are specific and memorable.',
    tips: [
      'Be specific about the problem it solves',
      'Use words that describe the expertise or domain',
      'Keep it concise and easy to remember',
      'Avoid generic names like "AI Helper"',
    ],
    examples: [
      'Bitcoin Tax Advisor',
      'Code Reviewer Pro',
      'Swiss Cheese Sommelier',
      'Startup Pitch Coach',
    ],
  },
  description: {
    icon: React.createElement(FileText, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Description',
    description: "Tell potential users what your bot can do and who it's for.",
    tips: [
      'Start with the main capability',
      'Mention the target audience',
      'Highlight unique features or expertise',
      'Keep it scannable (2-3 sentences)',
    ],
    examples: [
      'Expert Bitcoin tax advisor that helps you calculate capital gains...',
      'Code review assistant specializing in TypeScript and React...',
    ],
  },
  category: {
    icon: React.createElement(FileText, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Category',
    description: 'Categories help users discover your AI. Choose the most accurate one.',
    tips: [
      'Pick the category that best matches primary use case',
      'Think about where users would look for this type of help',
      'You can add tags for additional discoverability',
    ],
    examples: ['Business & Consulting', 'Code & Development', 'Education & Tutoring'],
  },
  system_prompt: {
    icon: React.createElement(Cpu, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'System Prompt',
    description:
      'This is the most important part! Your system prompt defines your AI\'s personality, knowledge, and behavior. Think of it as the "software" that makes your AI unique.',
    tips: [
      'Be specific about the role and expertise',
      'Define what the AI should and should NOT do',
      'Include response style guidelines',
      'Add domain-specific knowledge or context',
      'Set boundaries and limitations',
    ],
    examples: [
      'You are a Bitcoin tax specialist with deep knowledge of Swiss tax law...',
      'You are a senior code reviewer. Review code for bugs, security issues, and best practices...',
    ],
  },
  welcome_message: {
    icon: React.createElement(MessageSquare, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Welcome Message',
    description:
      'The first message users see when starting a conversation. Make a good first impression!',
    tips: [
      'Introduce what the AI can help with',
      'Be friendly and inviting',
      'Optionally suggest what users can ask',
      'Keep it brief (1-2 paragraphs)',
    ],
    examples: [
      "Hello! I'm your Bitcoin Tax Advisor. I can help you understand tax implications...",
    ],
  },
  model_preference: {
    icon: React.createElement(Cpu, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Model Preference',
    description: 'Choose which AI model powers your assistant.',
    tips: [
      'Select "Any" for automatic optimization',
      'GPT-4/Claude Opus: Best quality, higher cost',
      'GPT-3.5/Claude Haiku: Fast and affordable',
      'Your system prompt works with any model',
    ],
  },
  temperature: {
    icon: React.createElement(Cpu, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Temperature',
    description:
      'Controls randomness in responses. Lower = more deterministic, higher = more creative.',
    tips: [
      '0.0-0.3: Factual, consistent responses',
      '0.5-0.7: Balanced (recommended for most)',
      '0.8-1.2: Creative, varied responses',
      '1.5+: Very creative, may be unpredictable',
    ],
  },
  max_tokens_per_response: {
    icon: React.createElement(Cpu, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Max Tokens per Response',
    description: 'Limits how long each response can be. Helps control costs.',
    tips: [
      '~750 tokens = 500 words',
      'Short answers: 500-1000 tokens',
      'Detailed explanations: 2000-4000 tokens',
      'Higher limits = higher costs per message',
    ],
  },
  compute_provider_type: {
    icon: React.createElement(Cpu, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Compute Provider',
    description: 'Where your AI runs. Most users should select API Provider.',
    tips: [
      'API: Uses cloud AI providers (easiest)',
      'Self-Hosted: Your own GPU/server',
      'Community: Shared community resources',
    ],
  },
  pricing_model: {
    icon: React.createElement(DollarSign, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Pricing Model',
    description: 'Choose how users pay for your bot.',
    tips: [
      'Free: Great for building audience',
      'Per Message: Simple, predictable for users',
      'Per Token: Precise, varies by usage',
      'Subscription: Steady monthly income',
    ],
    examples: [
      'Free with 5 messages/day, then CHF 0.10/message',
      'CHF 1 per 1K tokens',
      'CHF 10/month subscription',
    ],
  },
  price_per_message: {
    icon: React.createElement(Zap, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Price per Message',
    description: 'How much to charge for each message sent. Enter in your preferred currency.',
    tips: [
      'Start low to attract users',
      'Increase as your AI proves value',
      'Consider your compute costs',
      'Free messages can help conversion',
    ],
  },
  price_per_1k_tokens: {
    icon: React.createElement(Zap, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Price per 1K Tokens',
    description: 'Token-based pricing for pay-as-you-go usage. Enter in your preferred currency.',
    tips: [
      'Tokens = words + punctuation (~750 tokens = 500 words)',
      'Typical range: CHF 0.01–0.10 per 1K tokens',
      'Users pay based on actual usage',
    ],
  },
  subscription_price: {
    icon: React.createElement(DollarSign, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Subscription Price',
    description:
      'Monthly subscription price for unlimited access. Enter in your preferred currency.',
    tips: [
      'Provides predictable income',
      'Users get unlimited messages',
      'Good for frequent-use assistants',
      'Typical range: CHF 5–50/month',
    ],
  },
  free_messages_per_day: {
    icon: React.createElement(MessageSquare, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Free Messages per Day',
    description: 'Let users try your AI for free before paying.',
    tips: [
      'Recommended: 3-10 free messages',
      "Helps users experience your AI's value",
      'Encourages conversion to paid',
      'Set to 0 for no free tier',
    ],
  },
  lightning_address: {
    icon: React.createElement(Zap, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Lightning Address',
    description: 'Your Lightning address for receiving instant micropayments.',
    tips: [
      'Recommended for AI payments',
      'Instant, low-fee transactions',
      'Format: you@provider.com',
      'Get one from Alby, Stacker News, etc.',
    ],
    examples: ['you@getalby.com', 'you@stacker.news'],
  },
  bitcoin_address: {
    icon: React.createElement(DollarSign, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Bitcoin Address',
    description: 'On-chain Bitcoin address for larger payments or fallback.',
    tips: [
      'Use a fresh address for privacy',
      'Fallback for larger accumulated payments',
      'Lightning is preferred for micropayments',
    ],
    examples: ['bc1q...'],
  },
};

export const aiAssistantDefaultGuidance: DefaultGuidance = {
  title: `What is a ${ENTITY_REGISTRY.ai_assistant.name.toLowerCase()}?`,
  description:
    'A bot is an AI with its own voice that you define. The key is a well-crafted system prompt that defines exactly how your AI should behave and what value it provides.',
  features: [
    {
      icon: React.createElement(Bot, { className: 'w-4 h-4 text-fg-primary' }),
      text: 'Build autonomous AI services',
    },
    {
      icon: React.createElement(Zap, { className: 'w-4 h-4 text-fg-primary' }),
      text: 'Earn Bitcoin via Lightning',
    },
    {
      icon: React.createElement(CheckCircle2, { className: 'w-4 h-4 text-fg-primary' }),
      text: 'Portable - works with any AI provider',
    },
  ],
  hint: 'Your system prompt is your AI\'s "software" - make it great!',
};
