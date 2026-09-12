/**
 * What the tool chip says Cat is doing — derived, not listed.
 *
 * The chip used to hold a hand-written map of 7 labels. Sixty-two distinct tool
 * names can reach it, so 55 of them rendered as "Working…" and then "Done (1)":
 * `send_message`, `fund_project` and `create_project` produced the same
 * sentence as each other and as everything else. A user watching Cat work could
 * not tell a payment from a follow.
 *
 * The data was never missing. `CAT_ACTIONS` already carries a Title Case
 * imperative `name` for every action ("Send Message", "Fund Project"). The UI
 * simply never asked it — the same bug as a provider list standing in for what
 * a model can do (ADR-0008), one layer up.
 *
 * So: ask the registry, and conjugate. "Send Message" becomes "Sending
 * message…" while it runs and "Sent message" when it lands.
 *
 * The one thing that cannot be derived is English. `VERB_FORMS` is a closed
 * table of the leading verbs the registry actually uses, because `send → sent`
 * and `build → built` are not reachable by rule, and a rule that guesses
 * produces "sended" in front of a user. A table can rot — so a test asserts it
 * covers every action in the registry. Add an action with a new verb and CI
 * fails with the verb it needs. That is the point: the list cannot drift
 * silently, which is the only thing wrong with lists.
 */
import { CAT_ACTIONS } from '@/config/cat-actions';

export interface ToolLabel {
  running: string;
  completed: (n: number) => string;
  noResults: string;
  failed: string;
  /** The action now waits on the confirmation card below the thread. */
  pending?: string;
  /** The user was asked and said no. Not a failure — see the event type. */
  declined?: string;
}

/**
 * Leading verb → its two other forms. Irregulars are the reason this exists.
 * Keys are lower-case; the table is closed and gate-enforced (see the header).
 */
export const VERB_FORMS: Record<string, { gerund: string; past: string }> = {
  accept: { gerund: 'Accepting', past: 'Accepted' },
  add: { gerund: 'Adding', past: 'Added' },
  archive: { gerund: 'Archiving', past: 'Archived' },
  book: { gerund: 'Booking', past: 'Booked' },
  build: { gerund: 'Building', past: 'Built' },
  cancel: { gerund: 'Cancelling', past: 'Cancelled' },
  comment: { gerund: 'Commenting', past: 'Commented' },
  complete: { gerund: 'Completing', past: 'Completed' },
  connect: { gerund: 'Connecting', past: 'Connected' },
  create: { gerund: 'Creating', past: 'Created' },
  decline: { gerund: 'Declining', past: 'Declined' },
  edit: { gerund: 'Editing', past: 'Edited' },
  follow: { gerund: 'Following', past: 'Followed' },
  forget: { gerund: 'Forgetting', past: 'Forgot' },
  fund: { gerund: 'Funding', past: 'Funded' },
  invite: { gerund: 'Inviting', past: 'Invited' },
  like: { gerund: 'Liking', past: 'Liked' },
  mark: { gerund: 'Marking', past: 'Marked' },
  post: { gerund: 'Posting', past: 'Posted' },
  propose: { gerund: 'Proposing', past: 'Proposed' },
  publish: { gerund: 'Publishing', past: 'Published' },
  remember: { gerund: 'Remembering', past: 'Remembered' },
  remove: { gerund: 'Removing', past: 'Removed' },
  reply: { gerund: 'Replying', past: 'Replied' },
  request: { gerund: 'Requesting', past: 'Requested' },
  save: { gerund: 'Saving', past: 'Saved' },
  send: { gerund: 'Sending', past: 'Sent' },
  set: { gerund: 'Setting', past: 'Set' },
  unfollow: { gerund: 'Unfollowing', past: 'Unfollowed' },
  update: { gerund: 'Updating', past: 'Updated' },
  watch: { gerund: 'Watching', past: 'Watched' },
};

/**
 * Lower-case the rest of a Title Case name WITHOUT damaging a proper noun.
 *
 * "Create Project" → "project", but "Send to FleetCrown" keeps FleetCrown and
 * "Create AI Assistant" keeps AI. A word is only lowered when it looks like an
 * ordinary capitalised word: one leading capital, then lower case. Anything
 * with internal capitals or all-caps is a name and is left exactly as written.
 */
function softLower(words: string[]): string {
  return words.map(w => (/^[A-Z][a-z]+$/.test(w) ? w.toLowerCase() : w)).join(' ');
}

/** The forms of one registry action's name, or null if it is not one. */
export function conjugateAction(toolName: string): {
  /** "Creating project" — while it runs. */
  gerund: string;
  /** "Created project" — once it landed. */
  past: string;
  /** "Create project" — the imperative, for a confirmation prompt. */
  plain: string;
  /**
   * "create project" — for use after "Couldn't". Only the VERB is lowered:
   * lowercasing the whole phrase would print "couldn't send to fleetcrown".
   */
  lower: string;
} | null {
  const action = CAT_ACTIONS[toolName];
  if (!action?.name) {
    return null;
  }
  const [head, ...rest] = action.name.split(' ');
  const forms = VERB_FORMS[head!.toLowerCase()];
  if (!forms) {
    return null;
  }
  const tail = softLower(rest);
  const join = (verb: string) => (tail ? `${verb} ${tail}` : verb);
  return {
    gerund: join(forms.gerund),
    past: join(forms.past),
    plain: join(head!),
    lower: join(head!.toLowerCase()),
  };
}

/**
 * Bespoke wording for the tools that READ rather than act.
 *
 * These stay hand-written on purpose: "Found 3 sources" is not a conjugation of
 * anything, and the distinction between `noResults` ("we looked and the world
 * is empty") and `failed` ("we never got to look") is the whole point of the
 * three-answer shape — it must not be flattened into a generic past tense.
 */
const READ_TOOL_LABELS: Record<string, ToolLabel> = {
  search_platform: {
    running: 'Searching',
    completed: n => `Found ${n} ${n === 1 ? 'result' : 'results'}`,
    noResults: 'No results',
    failed: 'Search failed',
  },
  prefill_entity_form: {
    running: 'Drafting',
    completed: n => (n > 0 ? `Drafted ${n} field${n === 1 ? '' : 's'}` : 'Draft ready'),
    noResults: 'Nothing to draft',
    failed: "Couldn't draft",
  },
  web_search: {
    running: 'Searching the web',
    completed: n => `Found ${n} ${n === 1 ? 'source' : 'sources'}`,
    noResults: 'Nothing on the web for that',
    failed: "Couldn't search the web",
  },
  read_page: {
    running: 'Reading',
    completed: () => 'Read the page',
    noResults: 'Nothing readable on that page',
    failed: "Couldn't read that page",
  },
  explore_topic: {
    running: 'Exploring',
    completed: n => `Found ${n} related ${n === 1 ? 'result' : 'results'}`,
    noResults: 'Nothing on this topic yet',
    failed: "Couldn't explore that topic",
  },
  query_my_data: {
    running: 'Reading your data',
    completed: () => 'Read your live data',
    noResults: 'Nothing on file',
    failed: "Couldn't read your data",
  },
  check_my_track_record: {
    running: 'Checking my own track record',
    completed: n => (n === 0 ? 'Nothing on my record yet' : `Checked my record (${n} created)`),
    noResults: 'Nothing on my record yet',
    failed: "Couldn't read my record",
  },
  analyze_website: {
    running: 'Reading the site',
    completed: () => 'Read the site',
    noResults: 'Nothing readable on that site',
    failed: "Couldn't read that site",
  },
  suggest_offers: {
    running: 'Looking for matches',
    completed: n => `Found ${n} ${n === 1 ? 'match' : 'matches'}`,
    noResults: 'Nothing to suggest yet',
    failed: "Couldn't look for matches",
  },
  check_cat_health: {
    running: 'Checking my own health',
    completed: () => 'Checked my health',
    noResults: 'Nothing to report',
    failed: "Couldn't check my health",
  },
};

export const DEFAULT_LABEL: ToolLabel = {
  running: 'Working',
  completed: n => `Done (${n})`,
  noResults: 'Nothing found',
  failed: 'Action failed',
  pending: 'Needs your confirmation — see below',
  declined: 'You declined this',
};

/**
 * The label for one tool call: bespoke wording if it reads, the registry's own
 * words if it acts, and the generic fallback only for something neither knows.
 */
export function labelForTool(toolName: string): ToolLabel {
  const read = READ_TOOL_LABELS[toolName];
  if (read) {
    return read;
  }
  const forms = conjugateAction(toolName);
  if (!forms) {
    return DEFAULT_LABEL;
  }
  return {
    running: forms.gerund,
    // `resultCount` is a hard-coded 1 for every action, so counting it would
    // print a number that means nothing. What happened is the useful fact.
    completed: () => forms.past,
    noResults: 'Nothing to do',
    failed: `Couldn't ${forms.lower}`,
    pending: `${forms.plain} — needs your confirmation`,
    declined: `${forms.plain} — declined`,
  };
}
