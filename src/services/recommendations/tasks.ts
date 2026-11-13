/**
 * TASK DEFINITIONS - SINGLE SOURCE OF TRUTH
 *
 * All recommended tasks are defined here. Tasks are evaluated dynamically
 * based on user context. No hardcoded tasks in components.
 *
 * PRINCIPLES:
 * - Each task has a condition function
 * - Tasks are prioritized by importance
 * - Categories group related tasks
 * - All strings and logic in one place
 *
 * Created: 2026-01-07
 * Last Modified: 2026-01-07
 */

import { isMintedHandle } from '@/config/usernames';
import {
  Star,
  Wallet,
  Edit3,
  Rocket,
  Package,
  Briefcase,
  Heart,
  Gift,
  Users,
  Globe,
  Share2,
  MessageSquare,
  Calendar,
  Hammer,
} from 'lucide-react';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { ROUTES } from '@/config/routes';
import { CAT_QUERY_PARAM } from '@/config/cat-door';
import type { TaskDefinition, SmartQuestion, UserContext } from './types';

/**
 * PROFILE COMPLETION FIELDS
 * Used to calculate profile completion percentage
 */
const PROFILE_FIELDS = [
  'username',
  'display_name',
  'bio',
  'avatar_url',
  'bitcoin_address',
  'lightning_address',
  'website',
  'location',
  'preferred_currency',
] as const;

/**
 * Calculate profile completion percentage
 */
export function calculateProfileCompletion(profile: UserContext['profile']): number {
  if (!profile) {
    return 0;
  }

  const filledFields = PROFILE_FIELDS.filter(field => {
    const value = profile[field as keyof typeof profile];
    return value !== null && value !== undefined && value !== '';
  });

  return Math.round((filledFields.length / PROFILE_FIELDS.length) * 100);
}

/**
 * TASK DEFINITIONS
 *
 * Organized by priority within category:
 * - Critical: Blocking issues that prevent core functionality
 * - High: Important for full platform experience
 * - Medium: Enhance engagement
 * - Low: Growth and exploration
 */
/**
 * Left nameless behind a minted handle (`user_a3eaa53c23cd`) — see the
 * set-display-name task for why it is this narrow.
 */
function needsDisplayName(ctx: UserContext): boolean {
  return !ctx.profile.display_name?.trim() && isMintedHandle(ctx.profile.username);
}

/** A link that opens the Cat with `sentence` already sent — the Cat door's own URL shape. */
function catAsk(sentence: string): string {
  return `${ROUTES.DASHBOARD.CAT}?${CAT_QUERY_PARAM}=${encodeURIComponent(sentence)}`;
}

export const TASK_DEFINITIONS: TaskDefinition[] = [
  // ==================== CRITICAL: Profile Setup ====================
  {
    id: 'set-username',
    title: 'Set your username',
    description: 'Choose a unique username for your profile URL',
    priority: 'critical',
    category: 'setup',
    action: { label: 'Set username', href: ROUTES.DASHBOARD.INFO_EDIT },
    icon: Star,
    condition: ctx => !ctx.profile.username,
  },
  // ==================== HIGH: The Cat sets you up ====================
  // First of the high rows, so for a person with nothing yet it leads the
  // checklist (the sort is stable): the Cat does the most setup per tap.
  {
    id: 'chat-with-cat',
    title: 'Let your Cat set you up',
    // The one step that does most of the others: first, so a new account's
    // visible pair is not two profile chores.
    leads: true,
    description:
      'Say who you are and what you need. It drafts your profile, a funding page and a website, and looks for people who might back you — you confirm each step.',
    priority: 'high',
    category: 'setup',
    // Opens the Cat with the request already typed, so the first thing the
    // person sees is the whole setup proposed, not an empty chat box.
    action: {
      label: 'Set me up',
      href: catAsk('Set me up — profile, a funding page and a website'),
    },
    icon: MessageSquare,
    // Show when the user has no entities at all — Cat is the best guide here
    condition: ctx => Object.values(ctx.entityCounts).reduce((sum, c) => sum + (c ?? 0), 0) === 0,
  },
  {
    id: 'set-display-name',
    title: 'Add your display name',
    description: 'Other people currently see a string of hex where your name should be',
    priority: 'high',
    category: 'setup',
    action: { label: 'Add name', href: ROUTES.DASHBOARD.INFO_EDIT },
    icon: Edit3,
    // Narrow on purpose: only the accounts left nameless AND handle-less by the
    // 2026-08-26 email-leak sweep, which retired the handle and cleared a display
    // name that was the email local part. Both halves were right; together they
    // left ~72 profiles rendering as `user_a3eaa53c23cd` in every thread,
    // mention and profile card. See migration 20260907090000.
    //
    // That migration restored everyone whose OAuth provider had given us a real
    // name. It could not invent one for the rest — and inventing one is exactly
    // the mistake being repaired — so the remainder have to be ASKED. This is
    // the asking.
    //
    // Conditioned on the MINTED handle, not merely on a missing name: someone who
    // chose a readable username and simply has not filled in a display name is
    // not broken and does not need a high-priority nag.
    condition: needsDisplayName,
  },
  {
    id: 'add-wallet',
    title: 'Add Bitcoin wallet',
    description: 'Connect a wallet when you want to receive Bitcoin payments or funding',
    priority: 'medium',
    category: 'setup',
    action: { label: 'Manage wallets', href: ENTITY_REGISTRY['wallet'].basePath },
    icon: Wallet,
    condition: ctx => !ctx.hasWallet,
  },

  // ==================== HIGH: Complete Profile ====================
  {
    // One row, not two: "Add your bio" and "Upload profile photo" (and the
    // name ask above) all opened the same form, so the checklist showed the
    // same destination three times and pushed the Cat's row out of view.
    id: 'complete-profile',
    title: 'Add a bio and a photo',
    description: 'Tell people who you are and put a face to it, so they know who they back',
    priority: 'high',
    category: 'setup',
    action: { label: 'Edit profile', href: ROUTES.DASHBOARD.INFO_EDIT },
    icon: Edit3,
    // Not while the name row shows: that row opens the same form.
    condition: ctx =>
      !!ctx.profile.username &&
      (!ctx.profile.bio || !ctx.profile.avatar_url) &&
      !needsDisplayName(ctx),
  },

  {
    id: 'get-a-website',
    title: 'Get a website for your project',
    description:
      'Your Cat can have Loki build a real site on its own address, linked to your funding page. You confirm before anything goes live.',
    priority: 'high',
    category: 'setup',
    action: { label: 'Ask for a website', href: catAsk('Build a website for my project') },
    icon: Hammer,
    condition: ctx => (ctx.entityCounts.project ?? 0) > 0 && !ctx.profile.website?.trim(),
  },

  // ==================== HIGH: First Entity Creation ====================
  {
    id: 'create-first-project',
    title: 'Launch your first project',
    description: 'Launch a project and start receiving support in just a few minutes',
    priority: 'high',
    category: 'create',
    action: { label: 'Create project', href: ENTITY_REGISTRY.project.createPath },
    icon: Rocket,
    relatedEntities: ['project'],
    condition: ctx =>
      ctx.hasWallet && ctx.profileCompletion >= 50 && (ctx.entityCounts.project ?? 0) === 0,
  },
  {
    id: 'create-first-product',
    title: 'List your first product',
    description: 'Start selling goods and services for Bitcoin',
    priority: 'high',
    category: 'create',
    action: { label: 'Create product', href: ENTITY_REGISTRY.product.createPath },
    icon: Package,
    relatedEntities: ['product'],
    condition: ctx =>
      ctx.hasWallet &&
      ctx.profileCompletion >= 50 &&
      (ctx.entityCounts.product ?? 0) === 0 &&
      (ctx.entityCounts.project ?? 0) > 0, // After they have a project
  },
  {
    id: 'create-first-service',
    title: 'Offer your first service',
    description: 'Monetize your skills and expertise',
    priority: 'high',
    category: 'create',
    action: { label: 'Create service', href: ENTITY_REGISTRY.service.createPath },
    icon: Briefcase,
    relatedEntities: ['service'],
    condition: ctx =>
      ctx.hasWallet &&
      ctx.profileCompletion >= 50 &&
      (ctx.entityCounts.service ?? 0) === 0 &&
      (ctx.entityCounts.project ?? 0) > 0,
  },

  // ==================== MEDIUM: Engagement ====================
  {
    id: 'create-wishlist',
    title: 'Create a wishlist',
    description: 'Let supporters fund specific items you need',
    priority: 'medium',
    category: 'create',
    action: { label: 'Create wishlist', href: ENTITY_REGISTRY.wishlist.createPath },
    icon: Gift,
    relatedEntities: ['wishlist'],
    condition: ctx => ctx.profileCompletion >= 75 && (ctx.entityCounts.wishlist ?? 0) === 0,
  },
  {
    id: 'add-wishlist-items',
    title: 'Add items to your wishlist',
    description: 'Your wishlist is empty. Add items supporters can fund.',
    priority: 'medium',
    category: 'engage',
    action: { label: 'Add items', href: ENTITY_REGISTRY['wishlist'].basePath },
    icon: Gift,
    condition: ctx => (ctx.entityCounts.wishlist ?? 0) > 0 && ctx.wishlistItemCount === 0,
  },
  {
    id: 'create-cause',
    title: 'Support a cause',
    description: 'Create a cause page to raise funds for something you believe in',
    priority: 'medium',
    category: 'create',
    action: { label: 'Create cause', href: ENTITY_REGISTRY.cause.createPath },
    icon: Heart,
    relatedEntities: ['cause'],
    condition: ctx =>
      ctx.profileCompletion === 100 &&
      (ctx.entityCounts.cause ?? 0) === 0 &&
      ctx.hasPublishedEntities,
  },
  {
    id: 'join-group',
    title: 'Join or create a group',
    description: 'Connect with like-minded people and collaborate',
    priority: 'medium',
    category: 'engage',
    action: { label: 'Explore groups', href: ROUTES.DISCOVER_TYPE('groups') },
    icon: Users,
    condition: ctx => ctx.profileCompletion >= 75 && (ctx.entityCounts.group ?? 0) === 0,
  },
  {
    id: 'create-event',
    title: 'Organize an event',
    description: 'Host a meetup or gathering for your community',
    priority: 'medium',
    category: 'create',
    action: { label: 'Create event', href: ENTITY_REGISTRY.event.createPath },
    icon: Calendar,
    relatedEntities: ['event'],
    condition: ctx =>
      ctx.profileCompletion === 100 &&
      (ctx.entityCounts.event ?? 0) === 0 &&
      ctx.hasPublishedEntities,
  },

  // ==================== LOW: Growth & Exploration ====================
  {
    id: 'explore-projects',
    title: 'Explore other projects',
    description: 'Discover and support projects in the community',
    priority: 'low',
    category: 'grow',
    action: { label: 'Explore', href: ROUTES.DISCOVER },
    icon: Globe,
    condition: ctx => ctx.profileCompletion >= 50,
  },
  {
    id: 'share-profile',
    title: 'Share your profile',
    description: 'Let your network know about your Bitcoin profile',
    priority: 'low',
    category: 'grow',
    action: {
      label: 'View profile',
      href: ROUTES.PROFILES.ME,
    },
    icon: Share2,
    condition: ctx => ctx.profileCompletion === 100,
  },
  {
    id: 'find-collaborators',
    title: 'Find collaborators',
    description: 'Connect with people who can help grow your projects',
    priority: 'low',
    category: 'grow',
    action: { label: 'Find people', href: ROUTES.DISCOVER_TYPE('people') },
    icon: Users,
    condition: ctx => (ctx.entityCounts.project ?? 0) > 0 && ctx.hasPublishedEntities,
  },
  {
    id: 'post-update',
    title: 'Post an update',
    description: 'Keep your supporters informed about your progress',
    priority: 'low',
    category: 'engage',
    action: { label: 'Create post', href: `${ROUTES.TIMELINE}/compose` },
    icon: MessageSquare,
    condition: ctx =>
      ctx.hasPublishedEntities &&
      (ctx.daysSinceLastActivity === null || ctx.daysSinceLastActivity > 7),
  },
];

/**
 * SMART QUESTIONS
 *
 * Contextual questions shown when profile is 100% complete
 * These encourage deeper engagement with specific features
 */
export const SMART_QUESTIONS: SmartQuestion[] = [
  {
    id: 'find-collaborators-q',
    question: 'You have projects live. Want to find collaborators?',
    action: { label: 'Find people', href: ROUTES.DISCOVER_TYPE('people') },
    condition: ctx => ctx.profileCompletion === 100 && (ctx.entityCounts.project ?? 0) > 0,
  },
  {
    id: 'share-wishlist-q',
    question: 'Your wishlist has items. Share it with supporters?',
    action: { label: 'Share wishlist', href: ENTITY_REGISTRY['wishlist'].basePath },
    condition: ctx => ctx.profileCompletion === 100 && ctx.wishlistItemCount > 0,
  },
  {
    id: 'update-supporters-q',
    question: "It's been a while since your last post. Update your supporters?",
    action: { label: 'Create post', href: `${ROUTES.TIMELINE}/compose` },
    condition: ctx =>
      ctx.profileCompletion === 100 &&
      ctx.hasPublishedEntities &&
      ctx.daysSinceLastActivity !== null &&
      ctx.daysSinceLastActivity > 7,
  },
  {
    id: 'explore-funding-q',
    question: 'Ready to explore funding opportunities?',
    action: { label: 'Browse projects', href: ROUTES.DISCOVER_TYPE('projects') },
    condition: ctx => ctx.profileCompletion === 100 && ctx.hasWallet && !ctx.hasPublishedEntities,
  },
  {
    id: 'grow-network-q',
    question: 'Want to grow your network? Join a group!',
    action: { label: 'Find groups', href: ROUTES.DISCOVER_TYPE('groups') },
    condition: ctx => ctx.profileCompletion === 100 && (ctx.entityCounts.group ?? 0) === 0,
  },
  {
    id: 'try-ai-q',
    question: 'Have you tried creating a bot to monetize?',
    action: {
      label: ENTITY_REGISTRY.ai_assistant.createActionLabel,
      href: ENTITY_REGISTRY.ai_assistant.createPath,
    },
    condition: ctx =>
      ctx.profileCompletion === 100 &&
      ctx.hasPublishedEntities &&
      (ctx.entityCounts.ai_assistant ?? 0) === 0,
  },
];

/**
 * CELEBRATION MESSAGES
 *
 * Shown when user completes different milestones
 */
export const CELEBRATION_MESSAGES = {
  profileComplete: {
    title: 'Profile complete',
    description: "Your profile is 100% complete. You're ready to make the most of OrangeCat!",
  },
  firstEntity: {
    title: 'First creation shipped',
    description: "Congratulations on creating your first listing! You're on your way.",
  },
  allSetupComplete: {
    title: 'All set',
    description: "You've completed all recommended setup tasks. Now let's grow!",
  },
  engagementMaster: {
    title: 'Engagement pro',
    description: 'You have a thriving presence on OrangeCat. Keep up the great work!',
  },
};
