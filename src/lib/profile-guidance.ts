/**
 * Profile Field Guidance Content
 *
 * Single source of truth for profile editing guidance.
 * Used by DynamicSidebar to provide contextual help for profile editing.
 * Same component as projects, just different content.
 *
 * Created: 2025-11-24
 * Last Modified: 2025-11-24
 * Last Modified Summary: Now uses shared DynamicSidebar component
 */

import React from 'react';
import {
  User,
  FileText,
  MapPin,
  Link as LinkIcon,
  Share2,
  Mail,
  Phone,
  Shield,
  Heart,
  Users,
  Home,
  EyeOff,
  Coins,
} from 'lucide-react';
import type { FieldGuidanceContent, DefaultContent } from '@/lib/project-guidance';

export type ProfileFieldType =
  | 'username'
  | 'name'
  | 'bio'
  | 'location'
  | 'physicalAddress'
  | 'website'
  | 'socialLinks'
  | 'contactEmail'
  | 'phone'
  | 'privacySettings'
  | 'currencyPreference'
  | null;

export const profileGuidanceContent: Record<NonNullable<ProfileFieldType>, FieldGuidanceContent> = {
  username: {
    icon: React.createElement(User, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Username',
    description:
      'Your unique identifier on the platform. This is how others will find and mention you.',
    tips: [
      '3-30 characters, letters, numbers, underscores, and hyphens only',
      'Must be unique across all users',
      'Can be changed later — your old handle keeps redirecting here',
      'This becomes your @handle (e.g., @yourname)',
      'Required field - you need this to use the platform',
    ],
    examples: ['@johndoe', '@bitcoin_enthusiast', '@zurich_creator', '@sarah_swiss'],
  },
  name: {
    icon: React.createElement(User, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Display Name',
    description:
      'How others will see you. More personal and flexible than username. Optional but recommended.',
    tips: [
      'Optional - defaults to username if empty',
      'Can be your real name or a display name',
      'More flexible than username (can include spaces, special characters)',
      'Helps build personal connection with supporters',
      'Max 100 characters',
    ],
    examples: ['John Doe', 'Bitcoin Enthusiast', 'Sarah from Zurich', 'Community Builder'],
  },
  bio: {
    icon: React.createElement(FileText, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Bio',
    description:
      "Tell your story. Share who you are, what you do, and why you're on OrangeCat. This builds trust and connection.",
    tips: [
      'Start with who you are and what you do',
      'Share your passion or mission',
      'Be authentic and personal',
      "Explain why you're seeking support",
      'Max 500 characters - be concise but meaningful',
    ],
    examples: [
      'Bitcoin educator and content creator. Helping people understand Bitcoin through clear explanations and real-world examples.',
      'Local community organizer in Zurich. Building tools to help neighbors support each other.',
    ],
  },
  location: {
    icon: React.createElement(MapPin, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Location',
    description:
      'Help local people and projects find you. Location enables neighborhood connections and local discovery.',
    tips: [
      'Start typing to search for your city or address',
      'Helps neighbors find you in their area',
      'Enables location-based search and discovery',
      'More specific = better (city, zip code)',
      'Optional but recommended for local connections',
    ],
    examples: ['Zurich, Switzerland', 'Basel, 4051', 'Geneva'],
  },
  website: {
    icon: React.createElement(LinkIcon, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Website',
    description:
      'Link to your personal website, blog, or portfolio. Helps build credibility and gives supporters more context.',
    tips: [
      'Must be a valid HTTP or HTTPS URL',
      'Can link to personal website, blog, portfolio',
      'Increases trust and transparency',
      'Optional but recommended for credibility',
      'Auto-adds https:// if you forget',
    ],
    examples: [
      'https://yourwebsite.com',
      'https://yourblog.substack.com',
      'https://github.com/yourusername',
    ],
  },
  socialLinks: {
    icon: React.createElement(Share2, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Social Media & Links',
    description:
      'Add links to your social media profiles and other platforms. Build credibility and help supporters find you elsewhere.',
    tips: [
      'Add links one at a time - start with your most important',
      'Common platforms: X, Instagram, Facebook, LinkedIn, GitHub, YouTube, Patreon',
      'Can also add custom links (e.g., OnlyFans, TikTok)',
      'Links let supporters verify who you are',
      'Optional but encouraged for credibility',
    ],
    examples: [
      'Add X: @yourhandle',
      'Add LinkedIn: https://linkedin.com/in/yourname',
      'Add YouTube: your channel name or URL',
    ],
  },
  contactEmail: {
    icon: React.createElement(Mail, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Contact Email',
    description:
      'Public email address for supporters to contact you. Different from your registration email (which is private).',
    tips: [
      'Defaults to your registration email (but you can change it)',
      'This will be visible on your public profile',
      'Use a different email if you want to keep registration email private',
      'Helps supporters reach out directly',
      'Optional but recommended for transparency',
    ],
    examples: ['contact@yourwebsite.com', 'hello@yourname.com'],
  },
  phone: {
    icon: React.createElement(Phone, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Phone Number',
    description:
      'Optional phone number for direct contact. Helps supporters reach you, especially for local connections.',
    tips: [
      'Use international format (e.g., +41 XX XXX XX XX)',
      'Completely optional',
      'Helps with local connections and urgent contact',
      'You can control visibility in privacy settings',
      'Can be left empty if you prefer email only',
    ],
    examples: ['+41 79 123 45 67', '+1 555 123 4567'],
  },
  physicalAddress: {
    icon: React.createElement(Home, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Physical Address',
    description:
      'Your physical address for receiving physical mail or goods. Essential for shipping and local services.',
    tips: [
      'Only visible if you enable it in privacy settings',
      'Required for physical product delivery or local services',
      'Increases trust for local community connections',
      'You control who can see this information',
      'Consider using a P.O. Box if you prefer privacy',
    ],
    examples: [
      'Bahnhofstrasse 1, 8001 Zürich, Switzerland',
      'Marktplatz 5, 4001 Basel, Switzerland',
    ],
  },
  privacySettings: {
    icon: React.createElement(EyeOff, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Privacy Settings',
    description:
      'Control what information is visible on your public profile. You enter the data once, then decide who sees it.',
    tips: [
      'Toggle visibility for each sensitive field',
      'Hidden fields are stored securely but not displayed publicly',
      'Location can be shown at city level even if exact address is hidden',
      'Review your public profile to see what others see',
      'More transparency generally builds more trust',
    ],
    examples: ['Show email: ON - Phone: OFF', 'Show city: ON - Full address: OFF'],
  },
  currencyPreference: {
    icon: React.createElement(Coins, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Currency Preference',
    description:
      'Choose your preferred currency for viewing amounts. All transactions happen in Bitcoin, but you can see equivalent values in your local currency.',
    tips: [
      "Defaults to your country's currency (e.g., CHF for Switzerland)",
      'Does not affect actual transactions - everything settles in Bitcoin',
      'Helps you understand amounts in familiar terms',
      'You can switch currencies anytime when viewing or entering amounts',
      'Exchange rates are updated regularly',
    ],
    examples: ['CHF for Switzerland', 'EUR for Germany, France, Italy', 'USD for United States'],
  },
};

export const profileDefaultContent: DefaultContent = {
  title: "What's a Profile?",
  description:
    'Your profile is your identity on OrangeCat. Share who you are, what you do, and connect with supporters who believe in your mission.',
  features: [
    {
      icon: React.createElement(Heart, { className: 'w-4 h-4 text-fg-primary' }),
      text: 'Build trust and credibility with a complete profile',
    },
    {
      icon: React.createElement(Users, { className: 'w-4 h-4 text-fg-primary' }),
      text: 'Help neighbors and supporters find you',
    },
    {
      icon: React.createElement(Shield, { className: 'w-4 h-4 text-fg-primary' }),
      text: 'Publishing a wallet ledger, and explaining what moved, earns a transparency score',
    },
  ],
  hint: '💡 Click on any field to get specific guidance',
};
