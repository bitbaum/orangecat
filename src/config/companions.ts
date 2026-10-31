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
    attach: {
      only: 'Sent with an attachment',
      noPhotos: (name: string) =>
        `${name} reads a photo on its own site; here it takes text and PDFs.`,
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
/**
 * How long a born companion's answer may run. The table default (1,000
 * tokens) cut a three-part proposal mid-sentence on the live site, and a
 * reasoning model that spends its budget thinking returned nothing at all.
 */
export const BORN_MAX_TOKENS = 2048;

/** The sentence every born-with definition opens with: how one is recognised later. */
export const STARTER_MARK = 'a companion made just now by the person you are talking to';

export function isStarterDefinition(prompt: string | null | undefined): boolean {
  return Boolean(prompt && prompt.includes(STARTER_MARK));
}

/**
 * The person's first answer, as the one line under the name: a label of a
 * few words, the way "Handler · handle things" reads. An option letter becomes
 * the option's words ("B" → "Organisation & everyday life"); "You are Skeptic:
 * find the two biggest flaws…" becomes "find the two biggest flaws"; anything
 * else is its first clause, cut to fit a row.
 */
export function jobLine(answer: string): string {
  const options = COMPANION_COPY.talk.starters.firstOptions;
  let text = answer.replace(/\s+/g, ' ').trim();
  const lettered = /^([A-E])(?:[.)]|\b)\s*(.*)$/i.exec(text);
  const option = lettered ? options[lettered[1].toUpperCase().charCodeAt(0) - 65] : undefined;
  if (lettered) {
    text = lettered[2].trim();
    if (option && text.toLowerCase().startsWith(option.toLowerCase())) {
      text = text.slice(option.length).replace(/^[.,:;\s]+/, '');
    }
  }
  // "You are Skeptic: …", "You're my coach — …": the job is what follows the name.
  text = text.replace(/^you(?:'re| are)\s+(?:my\s+)?[^.:—–,]{1,40}?\s*[:—–,]\s*/i, '');
  const clause = /^(.*?)(?:\s[—–]\s|[.:;!?]|$)/.exec(text)?.[1]?.trim() ?? '';
  const label = clause || option || text;
  const short = label.length > 60 ? `${label.slice(0, 59).trimEnd()}…` : label;
  return short.charAt(0).toLowerCase() + short.slice(1);
}

/**
 * The definition a companion keeps once the person has said what it is for:
 * their words, verbatim, with the rules the born-with one had. Written into
 * the companion itself (not a memory), so it holds in every conversation,
 * every group chat and every clone.
 */
export function jobDefinition(name: string, answer: string): string {
  return [
    `You are ${name}, a companion made by the person you are talking to.`,
    `Your job, in their own words: ${answer.trim()}`,
    'Do that job in every conversation and group chat. Never ask again what you are for. Be brief, warm and concrete; never pretend to have tools, files or connections you do not have.',
  ].join('\n');
}

export function starterDefinition(name: string): string {
  const options = COMPANION_COPY.talk.starters.firstOptions
    .map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`)
    .join('\n');
  return [
    `You are ${name}, ${STARTER_MARK}.`,
    `You do not have a job yet. In your very first message, greet them by saying you are ready as soon as they tell you what they need you for, then ask: "${COMPANION_COPY.talk.starters.firstQuestion}" with these choices on their own lines:`,
    options,
    'When they answer, say in one line what you will be for them from now on and ask one short question that helps you do it well. Keep what they tell you about your job and use it in every later conversation; once you know it, never ask the question again, in any conversation or group chat, and do the job instead. Be brief, warm and concrete; never pretend to have tools, files or connections you do not have.',
  ].join('\n');
}
