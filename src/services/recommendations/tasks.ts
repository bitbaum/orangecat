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
} from 'lucide-react';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { ROUTES } from '@/config/routes';
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
export const TASK_DEFINITIONS: TaskDefinition[] = [
  // ==================== CRITICAL: Profile Setup ====================
  {
    id: 'set-username',
    title: 'Set Your Username',
    description: 'Choose a unique username for your profile URL',
    priority: 'critical',
    category: 'setup',
    action: { label: 'Set Username', href: ROUTES.DASHBOARD.INFO_EDIT },
    icon: Star,
    condition: ctx => !ctx.profile.username,
  },
  {
    id: 'set-display-name',
    title: 'Add Your Display Name',
    description: 'Other people currently see a string of hex where your name should be',
    priority: 'high',
    category: 'setup',
    action: { label: 'Add Name', href: ROUTES.DASHBOARD.INFO_EDIT },
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
    condition: ctx => !ctx.profile.display_name?.trim() && isMintedHandle(ctx.profile.username),
  },
  {
    id: 'add-wallet',
    title: 'Add Bitcoin Wallet',
    description: 'Connect a wallet to receive Bitcoin payments and funding',
    priority: 'critical',
    category: 'setup',
    action: { label: 'Manage Wallets', href: ENTITY_REGISTRY['wallet'].basePath },
    icon: Wallet,
    condition: ctx => !ctx.hasWallet,
  },

  // ==================== HIGH: Complete Profile ====================
  {
    id: 'add-bio',
    title: 'Add Your Bio',
    description: 'Tell people about yourself and your mission',
    priority: 'high',
    category: 'setup',
    action: { label: 'Add Bio', href: ROUTES.DASHBOARD.INFO_EDIT },
    icon: Edit3,
    condition: ctx => !ctx.profile.bio && !!ctx.profile.username,
  },
  {
    id: 'add-avatar',
    title: 'Upload Profile Photo',
    description: 'Add a profile photo to build trust with supporters',
    priority: 'high',
    category: 'setup',
    action: { label: 'Upload Photo', href: ROUTES.DASHBOARD.INFO_EDIT },
    icon: Star,
    condition: ctx => !ctx.profile.avatar_url && !!ctx.profile.username,
  },

  // ==================== HIGH: Cat Consult (before first entity) ====================
  {
    id: 'chat-with-cat',
    title: 'Ask Cat what to create first',
    description:
      'Cat is your AI economic agent — describe your goals and it will suggest the right first step',
    priority: 'high',
    category: 'setup',
    action: { label: 'Open Cat', href: ROUTES.DASHBOARD.CAT },
    icon: MessageSquare,
    // Show when the user has no entities at all — Cat is the best guide here
    condition: ctx => Object.values(ctx.entityCounts).reduce((sum, c) => sum + (c ?? 0), 0) === 0,
  },

  // ==================== HIGH: First Entity Creation ====================
  {
    id: 'create-first-project',
    title: 'Launch Your First Project',
    description: 'Launch a project and start receiving support in just a few minutes',
    priority: 'high',
    category: 'create',
    action: { label: 'Create Project', href: ENTITY_REGISTRY.project.createPath },
    icon: Rocket,
    relatedEntities: ['project'],
    condition: ctx =>
      ctx.hasWallet && ctx.profileCompletion >= 50 && (ctx.entityCounts.project ?? 0) === 0,
  },
  {
    id: 'create-first-product',
    title: 'List Your First Product',
    description: 'Start selling goods and services for Bitcoin',
    priority: 'high',
    category: 'create',
    action: { label: 'Create Product', href: ENTITY_REGISTRY.product.createPath },
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
    title: 'Offer Your First Service',
    description: 'Monetize your skills and expertise',
    priority: 'high',
    category: 'create',
    action: { label: 'Create Service', href: ENTITY_REGISTRY.service.createPath },
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
    title: 'Create a Wishlist',
    description: 'Let supporters fund specific items you need',
    priority: 'medium',
    category: 'create',
    action: { label: 'Create Wishlist', href: ENTITY_REGISTRY.wishlist.createPath },
    icon: Gift,
    relatedEntities: ['wishlist'],
    condition: ctx => ctx.profileCompletion >= 75 && (ctx.entityCounts.wishlist ?? 0) === 0,
  },
  {
    id: 'add-wishlist-items',
    title: 'Add Items to Your Wishlist',
    description: 'Your wishlist is empty. Add items supporters can fund.',
    priority: 'medium',
    category: 'engage',
    action: { label: 'Add Items', href: ENTITY_REGISTRY['wishlist'].basePath },
    icon: Gift,
    condition: ctx => (ctx.entityCounts.wishlist ?? 0) > 0 && ctx.wishlistItemCount === 0,
  },
  {
    id: 'create-cause',
    title: 'Support a Cause',
    description: 'Create a cause page to raise funds for something you believe in',
    priority: 'medium',
    category: 'create',
    action: { label: 'Create Cause', href: ENTITY_REGISTRY.cause.createPath },
    icon: Heart,
    relatedEntities: ['cause'],
    condition: ctx =>
      ctx.profileCompletion === 100 &&
      (ctx.entityCounts.cause ?? 0) === 0 &&
      ctx.hasPublishedEntities,
  },
  {
    id: 'join-group',
    title: 'Join or Create a Group',
    description: 'Connect with like-minded people and collaborate',
    priority: 'medium',
    category: 'engage',
    action: { label: 'Explore Groups', href: ROUTES.DISCOVER_TYPE('groups') },
    icon: Users,
    condition: ctx => ctx.profileCompletion >= 75 && (ctx.entityCounts.group ?? 0) === 0,
  },
  {
    id: 'create-event',
    title: 'Organize an Event',
    description: 'Host a meetup or gathering for your community',
    priority: 'medium',
    category: 'create',
    action: { label: 'Create Event', href: ENTITY_REGISTRY.event.createPath },
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
    title: 'Explore Other Projects',
    description: 'Discover and support projects in the community',
    priority: 'low',
    category: 'grow',
    action: { label: 'Explore', href: ROUTES.DISCOVER },
    icon: Globe,
    condition: ctx => ctx.profileCompletion >= 50,
  },
  {
    id: 'share-profile',
    title: 'Share Your Profile',
    description: 'Let your network know about your Bitcoin profile',
    priority: 'low',
    category: 'grow',
    action: {
      label: 'View Profile',
      href: ROUTES.PROFILES.ME,
    },
    icon: Share2,
    condition: ctx => ctx.profileCompletion === 100,
  },
  {
    id: 'find-collaborators',
    title: 'Find Collaborators',
    description: 'Connect with people who can help grow your projects',
    priority: 'low',
    category: 'grow',
    action: { label: 'Find People', href: ROUTES.DISCOVER_TYPE('people') },
    icon: Users,
    condition: ctx => (ctx.entityCounts.project ?? 0) > 0 && ctx.hasPublishedEntities,
  },
  {
    id: 'post-update',
    title: 'Post an Update',
    description: 'Keep your supporters informed about your progress',
    priority: 'low',
    category: 'engage',
    action: { label: 'Create Post', href: `${ROUTES.TIMELINE}/compose` },
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
    action: { label: 'Find People', href: ROUTES.DISCOVER_TYPE('people') },
    condition: ctx => ctx.profileCompletion === 100 && (ctx.entityCounts.project ?? 0) > 0,
  },
  {
    id: 'share-wishlist-q',
    question: 'Your wishlist has items. Share it with supporters?',
    action: { label: 'Share Wishlist', href: ENTITY_REGISTRY['wishlist'].basePath },
    condition: ctx => ctx.profileCompletion === 100 && ctx.wishlistItemCount > 0,
  },
  {
    id: 'update-supporters-q',
    question: "It's been a while since your last post. Update your supporters?",
    action: { label: 'Create Post', href: `${ROUTES.TIMELINE}/compose` },
    condition: ctx =>
      ctx.profileCompletion === 100 &&
      ctx.hasPublishedEntities &&
      ctx.daysSinceLastActivity !== null &&
      ctx.daysSinceLastActivity > 7,
  },
  {
    id: 'explore-funding-q',
    question: 'Ready to explore funding opportunities?',
    action: { label: 'Browse Projects', href: ROUTES.DISCOVER_TYPE('projects') },
    condition: ctx => ctx.profileCompletion === 100 && ctx.hasWallet && !ctx.hasPublishedEntities,
  },
  {
    id: 'grow-network-q',
    question: 'Want to grow your network? Join a group!',
    action: { label: 'Find Groups', href: ROUTES.DISCOVER_TYPE('groups') },
    condition: ctx => ctx.profileCompletion === 100 && (ctx.entityCounts.group ?? 0) === 0,
  },
  {
    id: 'try-ai-q',
    question: 'Have you tried creating an AI assistant to monetize?',
    action: { label: 'Create AI Assistant', href: ENTITY_REGISTRY.ai_assistant.createPath },
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
