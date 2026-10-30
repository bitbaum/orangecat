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

  /** The talk home: companions, group chats and the fleet's bots as one list. */
  talk: {
    title: 'Companions',
    search: 'Search',
    newCompanion: 'New companion',
    newGroup: 'New group chat',
    /** Under a name, when the companion has no description yet. */
    noJob: 'Tell it what it is for',
    noActivityYet: 'Say hello',
    empty: {
      title: 'Nobody here yet',
      body: 'The fleet\u2019s agents and your own, one list. Talk to any of them, or put a few in a group chat and set them on one thing together.',
    },
    fleetUnreachable: 'The fleet\u2019s bots are out of reach right now.',
    fleetLine: (host: string) => `Answers from ${host}; nothing here is kept.`,
    groupLine: (n: number) => `${n} in this chat`,
    back: 'Back',
    details: 'Details',
    close: 'Close',
    create: {
      title: 'New companion',
      name: 'Give your companion a name',
      shape: 'Shape',
      colour: 'Colour',
      submit: 'Create',
      creating: 'Creating…',
      failed: 'That did not go through. Try again.',
    },
    room: {
      title: 'New group chat',
      to: 'To:',
      searchBots: 'Search companions',
      next: 'Start',
      needTwo: 'Pick two to six.',
      placeholder: (title: string) => `Message ${title} — @ a name to hand it the floor`,
      remove: 'Remove',
      addMember: 'Add member',
      nobodyToAdd: 'Everyone you can seat is already here.',
      working: (name: string) => `${name} is writing`,
      failedTurn: (name: string, why: string) => `${name} could not answer: ${why}`,
      rename: 'Rename',
      leave: 'Delete group chat',
      leaveConfirm: 'Delete this group chat? The transcript goes with it.',
      members: 'In this chat',
      open: 'Open',
    },
    fleet: {
      placeholder: (name: string) => `Ask ${name}`,
      open: (name: string) => `Open ${name}`,
      keptHere: 'This chat stays in this browser.',
      working: (name: string) => `${name} is thinking`,
    },
    companion: {
      placeholder: (name: string) => `Ask ${name}`,
      working: (name: string) => `${name} is thinking`,
      profile: 'Profile',
      memory: (name: string) => `What ${name} remembers`,
      edit: 'Edit',
    },
    starters: {
      /** What a brand-new companion is told, and what it asks first. */
      firstQuestion: 'What should I help you with most?',
      firstOptions: [
        'Development & code',
        'Organisation & everyday life',
        'Writing & communication',
        'Research & planning',
        'Something else',
      ],
    },
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

/**
 * The definition a companion is born with when it is made in a minute (a name
 * and a face, no form). It asks what it is for, and what the person answers is
 * REMEMBERED (companion memory, per person), so the job is said once, in chat,
 * never typed into a field. The creator can still write a full definition on
 * the edit page; this is the floor, not the ceiling.
 */
export function starterDefinition(name: string): string {
  const options = COMPANION_COPY.talk.starters.firstOptions
    .map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`)
    .join('\n');
  return [
    `You are ${name}, a companion made just now by the person you are talking to.`,
    `You do not have a job yet. In your very first message, greet them by saying you are ready as soon as they tell you what they need you for, then ask: "${COMPANION_COPY.talk.starters.firstQuestion}" with these choices on their own lines:`,
    options,
    'When they answer, say in one line what you will be for them from now on and ask one short question that helps you do it well. Keep what they tell you about your job and use it in every later conversation. Be brief, warm and concrete; never pretend to have tools, files or connections you do not have.',
  ].join('\n');
}
