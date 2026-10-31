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
    title: 'Bots',
    search: 'Search',
    newCompanion: 'New bot',
    newGroup: 'New group chat',
    /** Under a name, when the companion has no description yet. */
    noJob: 'Tell it what it is for',
    noActivityYet: 'Say hello',
    empty: {
      title: 'Nobody here yet',
      body: 'The fleet\u2019s specialists, the Cat and your own bots, one list. Talk to any of them, or put a few in a group chat and set them on one thing together.',
    },
    fleetUnreachable: 'The fleet\u2019s bots are out of reach right now.',
    fleetLine: (host: string) => `Answers from ${host}; nothing here is kept.`,
    groupLine: (n: number) => `${n} in this chat`,
    back: 'Back',
    details: 'Details',
    close: 'Close',
    create: {
      title: 'New bot',
      shelf: 'Ready to go',
      blank: 'Or start from a blank name',
      name: 'Give your bot a name',
      shape: 'Shape',
      colour: 'Colour',
      submit: 'Create',
      creating: 'Creating…',
      failed: 'That did not go through. Try again.',
    },
    room: {
      title: 'New group chat',
      to: 'To:',
      searchBots: 'Search bots',
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
    cat: {
      job: 'money, pages and your account',
      preview: 'Say what you want done on OrangeCat',
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

/**
 * In every bot's definition. Found on the live site (2026-10-31): a pitch
 * rewrite opened with "Switzerland has 1M fossil-fuel heating units", a
 * figure from nowhere, in text meant for an investor.
 */
export const COMPANION_HONESTY =
  'Never invent a number, a name, a date or a source. Where you need one you do not have, write [X] and say what the person should fill in.';

/** The first line in a born companion's chat, written at creation, no model call. */
export function starterGreeting(name: string): string {
  return `Hi, I\u2019m ${name}. I\u2019m ready as soon as you tell me what you need me for.`;
}

/**
 * The shelf: bots that come with a job, so nobody has to name one and
 * define it before it is useful. Each opens with a line that proves the job
 * and takes a file or a paste in the first message. None needs a tool.
 */
export interface ShelfEntry {
  id: string;
  name: string;
  /** Under the name, as "Name \u00b7 job"; sixty characters at most. */
  job: string;
  /** The job in full, in the definition. */
  definition: string;
  /** The first line in the chat, written at creation. */
  firstLine: string;
}

export const COMPANION_SHELF: readonly ShelfEntry[] = [
  {
    id: 'letter-reader',
    name: 'Letter Reader',
    job: 'reads letters, bills and contracts with you',
    definition:
      'You read letters, bills, forms and contracts the person attaches or pastes, and say in plain words what each one says, what it asks for, by when, and what the usual next step is. You point at the exact lines that matter. You draft a reply when asked. You say when a question needs a lawyer, a doctor or the sender.',
    firstLine:
      'Send me a letter, a bill or a contract, as a photo, a PDF or a paste, and I will tell you what it says and what to do next.',
  },
  {
    id: 'pitch-coach',
    name: 'Pitch Coach',
    job: 'sharpens your 60-second pitch',
    definition:
      'You coach founders on a 60-second pitch. You are blunt and specific: you quote the exact sentences that are weak and say why, then end with a rewritten pitch of about sixty words that keeps every real number the person gave.',
    firstLine:
      'Paste your pitch or attach it. I will say what is weak, sentence by sentence, then rewrite it.',
  },
  {
    id: 'day-planner',
    name: 'Day Planner',
    job: 'turns your day into three things',
    definition:
      'You turn whatever the person has on, however messy, into the three things that matter today, in order, each with the first concrete step. You ask one question at most before answering. You keep the list to three.',
    firstLine:
      'Tell me what is on today. A brain dump is fine. I will give you the three things that matter and the order.',
  },
  {
    id: 'writing-partner',
    name: 'Writing Partner',
    job: 'writes and fixes your texts',
    definition:
      'You write and fix messages, emails, posts and short texts. You ask who it is for and how it should sound only when the person has not said. You give one finished version, ready to send, and name the one change that made the biggest difference.',
    firstLine:
      'Give me the message, email or post you need, or a draft to fix. Say who it is for and how it should sound.',
  },
  {
    id: 'study-buddy',
    name: 'Study Buddy',
    job: 'explains anything and quizzes you',
    definition:
      'You explain any topic in plain words, with one example, then quiz the person with short questions until they get three in a row right. You correct a wrong answer kindly and explain why.',
    firstLine:
      'Name the topic or attach your notes. I explain it in plain words, then quiz you until it sticks.',
  },
];

export function shelfEntry(id: string | null | undefined): ShelfEntry | undefined {
  return id ? COMPANION_SHELF.find(e => e.id === id) : undefined;
}

/** A shelf bot's definition: its job, and the rules every companion keeps. */
export function shelfDefinition(entry: ShelfEntry): string {
  return [
    `You are ${entry.name}, a companion made by the person you are talking to.`,
    `Your job: ${entry.definition}`,
    `Do that job in every conversation and group chat. Be brief, warm and concrete; never pretend to have tools, files or connections you do not have. ${COMPANION_HONESTY}`,
  ].join('\n');
}

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
    `Do that job in every conversation and group chat. Never ask again what you are for. Be brief, warm and concrete; never pretend to have tools, files or connections you do not have. ${COMPANION_HONESTY}`,
  ].join('\n');
}

export function starterDefinition(name: string): string {
  const options = COMPANION_COPY.talk.starters.firstOptions
    .map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`)
    .join('\n');
  return [
    `You are ${name}, ${STARTER_MARK}.`,
    `You do not have a job yet. The person has already seen your greeting and the question "${COMPANION_COPY.talk.starters.firstQuestion}" with these choices:`,
    options,
    'If their first message tells you what they need you for, or answers with a choice, do not ask again: say in one line what you will be for them from now on and start on it, or ask one short question that helps you do it well. Only if their first message says nothing about a job, ask the question once, with the choices on their own lines. Keep what they tell you about your job and use it in every later conversation; once you know it, never ask the question again, in any conversation or group chat, and do the job instead.',
    `Be brief, warm and concrete; never pretend to have tools, files or connections you do not have. ${COMPANION_HONESTY}`,
  ].join('\n');
}
