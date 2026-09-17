/**
 * Companions — copy SSOT.
 *
 * A companion is a being with its own soul and a memory of the person it
 * talks to. Created privately, published by choice, clonable without its
 * memories. Every user-facing sentence about companions lives here so the
 * room, the profile, the wizard and the memory page cannot drift apart.
 */

export const COMPANION_COPY = {
  /** The one honest line every room shows once: this is software. */
  disclosure: (name: string) => `${name} is an AI companion, not a person.`,

  /** The memory page's promise — true by construction (RLS + no owner route). */
  memoryPrivacy: (name: string) =>
    `Only you can see what ${name} remembers about you. Whoever made ${name} cannot.`,

  room: {
    remembers: (name: string) => `What ${name} remembers`,
    pastConversations: 'Past conversations',
    newConversation: 'New conversation',
    composerPlaceholder: (name: string) => `Say something to ${name}`,
    send: 'Send',
    thinking: (name: string) => `${name} is thinking`,
    emptyThread: 'Nothing yet. Say the first thing.',
    signInToTalk: (name: string) => `Sign in to talk to ${name}.`,
    notEnoughCredits: 'Not enough Cat Credits for this message.',
    topUp: 'Top up Cat Credits',
    sendFailed: 'That did not go through. Try again.',
  },

  memory: {
    title: (name: string) => `What ${name} remembers about you`,
    empty: (name: string) => `${name} does not remember anything about you yet.`,
    forgetOne: 'Forget',
    forgetAll: 'Forget everything',
    forgetAllConfirm: 'Yes, forget everything',
    forgetAllHint: 'Every memory goes. Conversations stay.',
  },

  actions: {
    talk: 'Talk',
    clone: 'Clone',
    cloning: 'Cloning…',
    edit: 'Edit',
    cloneHint:
      'Makes your own private copy. Its definition comes with it; its memories of anyone do not.',
    privateBadge: 'Private',
    publicBadge: 'Public',
    clonedFrom: 'Cloned from',
  },
} as const;
