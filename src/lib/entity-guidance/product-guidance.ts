/**
 * Product Field Guidance Content
 *
 * Single source of truth for product creation guidance.
 * Used by DynamicSidebar to provide contextual help.
 *
 * Created: 2025-12-03
 * Last Modified: 2025-12-03
 * Last Modified Summary: Initial product guidance content
 */

import React from 'react';
import {
  Package,
  FileText,
  DollarSign,
  Tag,
  Layers,
  Truck,
  Image,
  BarChart3,
  CheckCircle2,
} from 'lucide-react';
import type { GuidanceContent, DefaultGuidance } from '@/components/create/types';

export type ProductFieldType =
  | 'title'
  | 'description'
  | 'category'
  | 'product_type'
  | 'price'
  | 'currency'
  | 'inventory_count'
  | 'fulfillment_type'
  | 'thumbnail_url'
  | 'tags'
  | null;

export const productGuidanceContent: Record<NonNullable<ProductFieldType>, GuidanceContent> = {
  title: {
    icon: React.createElement(Package, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Product Title',
    description:
      'The title is the first thing buyers see. Make it clear, descriptive, and searchable.',
    tips: [
      "Be specific about what you're selling",
      'Include key details (size, color, material)',
      'Keep it under 60 characters for best display',
      'Use words buyers would search for',
      'Avoid ALL CAPS or excessive punctuation',
    ],
    examples: [
      'Handmade Ceramic Coffee Mug - 12oz Blue',
      'Bitcoin Hardware Wallet Carry Case',
      'Organic Swiss Honey - 500g Jar',
    ],
  },
  description: {
    icon: React.createElement(FileText, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Product Description',
    description:
      "Tell the story of your product. Help buyers understand exactly what they're getting.",
    tips: [
      'Start with the most important features',
      'Include dimensions, materials, and specifications',
      "Explain how it's made or sourced",
      'Mention what makes it unique or special',
      'Add care instructions if relevant',
    ],
    examples: [
      'This handmade ceramic mug is crafted in my Zurich studio using locally-sourced clay...',
      'Premium leather case designed specifically for hardware wallets. Features...',
    ],
  },
  category: {
    icon: React.createElement(Tag, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Category',
    description: 'Categories help buyers find your product. Choose the most accurate category.',
    tips: [
      'Pick the category that best describes your product',
      'If unsure, think about where buyers would look',
      'You can add tags for additional discoverability',
      'Common categories: Handmade, Digital, Food, Electronics',
    ],
    examples: ['Handmade', 'Digital Products', 'Food & Drinks', 'Electronics'],
  },
  product_type: {
    icon: React.createElement(Layers, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Product Type',
    description: 'This determines how your product is delivered and what information buyers need.',
    tips: [
      "Physical: Ships to buyer's address",
      'Digital: Delivered electronically (files, links)',
      'Service: Work you perform for the buyer',
      'This affects shipping and fulfillment options',
    ],
    examples: [
      'Physical: Clothing, accessories, handmade goods',
      'Digital: E-books, templates, software',
      'Service: Consulting, design work',
    ],
  },
  price: {
    icon: React.createElement(DollarSign, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Price',
    description:
      'Set your price in your preferred currency (CHF by default). All payments settle in Bitcoin.',
    tips: [
      'Research similar products to price competitively',
      'Consider your costs, time, and materials',
      "Factor in shipping if you're covering it",
      'Buyers see the price in their chosen display currency',
      'You can adjust prices anytime',
    ],
    examples: [
      'CHF 50 for handmade items',
      'CHF 10 for digital products',
      'CHF 500 for premium items',
    ],
  },
  currency: {
    icon: React.createElement(DollarSign, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Display Currency',
    description:
      'Choose how to display your price. All payments are in Bitcoin, but you can show equivalent fiat.',
    tips: [
      'BTC is the native Bitcoin unit',
      'CHF (or your local currency) shows a familiar equivalent',
      'Price is always paid in Bitcoin',
    ],
    examples: ['CHF 50', '0.0005 BTC'],
  },
  inventory_count: {
    icon: React.createElement(BarChart3, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Inventory Count',
    description: 'Track how many items you have available. Set to -1 for unlimited stock.',
    tips: [
      'Set accurate counts to avoid overselling',
      'Use -1 for digital products or unlimited stock',
      'Inventory updates automatically when sold',
      "You'll be notified when stock is low",
    ],
    examples: [
      '10 - Limited edition items',
      '-1 - Unlimited (digital products)',
      '50 - Standard inventory',
    ],
  },
  fulfillment_type: {
    icon: React.createElement(Truck, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'How the buyer gets it',
    description:
      'What happens after someone pays. Today you always do the delivering — OrangeCat notifies you of each paid order.',
    tips: [
      'Ship or hand over: prints, mugs, anything physical',
      'Send a file or link: photos, e-books, templates — you send it after payment',
      'OrangeCat does not host or send files yet, so keep the file ready to send',
    ],
    examples: [
      'Framed print → ship or hand over',
      'High-resolution photo download → send a file or link',
    ],
  },
  thumbnail_url: {
    icon: React.createElement(Image, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Photo',
    description:
      'The picture buyers see first, on your listing and wherever it is shared. Drop, paste or click to add one.',
    tips: [
      'Well lit, the product filling the frame',
      'Large photos are resized for you',
      'Selling a photo or artwork? Use a smaller or watermarked version here — this image is public',
    ],
    examples: ['A print: the framed piece on a wall', 'A digital photo: a watermarked preview'],
  },
  tags: {
    icon: React.createElement(Tag, { className: 'w-5 h-5 text-fg-primary' }),
    title: 'Tags',
    description: 'Tags help buyers discover your product through search.',
    tips: [
      'Add relevant keywords buyers might search',
      'Include material, style, use case',
      'Use 3-5 focused tags',
      "Don't repeat category in tags",
    ],
    examples: [
      'handmade, ceramic, coffee, gift',
      'bitcoin, hardware wallet, security',
      'organic, local, swiss, honey',
    ],
  },
};

export const productDefaultGuidance: DefaultGuidance = {
  title: 'What is a Product?',
  description:
    'Products are items you sell on your personal marketplace. Physical goods, digital downloads, or services - all paid in Bitcoin.',
  features: [
    {
      icon: React.createElement(Package, { className: 'w-4 h-4 text-fg-primary' }),
      text: 'Sell physical or digital products',
    },
    {
      icon: React.createElement(DollarSign, { className: 'w-4 h-4 text-fg-primary' }),
      text: 'Get paid instantly in Bitcoin',
    },
    {
      icon: React.createElement(CheckCircle2, { className: 'w-4 h-4 text-fg-primary' }),
      text: 'Manage inventory and fulfillment',
    },
  ],
  hint: '💡 Click on any field to get specific guidance',
};
