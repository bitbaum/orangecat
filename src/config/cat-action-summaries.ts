/**
 * Cat action summaries: words for the person, not the model.
 *
 * `CatAction.description` (src/config/cat-actions.ts) is part of the tool
 * prompt the model reads: it names other tool ids, shouts NOT and STARTED,
 * and talks about "the user". The permission screens used to render it as is.
 * These are the lines a person reads beside each switch instead: one sentence,
 * second person, no tool ids, about 90 characters at most.
 *
 * Keyed by action id. `__tests__/unit/config/cat-action-summaries.test.ts`
 * fails when an action has no summary, a summary names no action, or a
 * summary reads like a prompt.
 */

export const CAT_ACTION_SUMMARIES: Record<string, string> = {
  // Investor room
  get_investor_room: 'Read your investor room: the deck, who has a link and who opened it.',
  save_investor_room: 'Edit the text of your investor room.',
  create_investor_room_link: 'Make a private link to your investor room for one person.',
  revoke_investor_room_link: 'Switch off one person’s link to your investor room.',
  generate_investor_deck: 'Draft an investor deck from what your project already shows.',
  save_investor_deck: 'Save changes you made to your investor deck.',

  // My things
  create_product: 'Create a product listing for you to sell.',
  create_service: 'Create a service you offer.',
  create_project: 'Create a project with a funding goal.',
  create_cause: 'Create an ongoing cause people can support.',
  create_event: 'Create an event from one sentence and put it on the map.',
  create_asset: 'List something you own to rent out or sell.',
  create_venue: 'Create a page for your bar, club or studio.',
  create_investment: 'Create an investment offer: equity, revenue share or debt.',
  create_loan: 'Ask people to lend you Bitcoin.',
  create_research: 'Create a research project people can fund.',
  review_research: 'Post a public review of someone else’s research in your name.',
  create_wishlist: 'Create a wishlist others can fund.',
  create_ai_assistant: 'Build an AI assistant that people can pay to use.',
  create_circle: 'Start a circle around something you care about.',
  build_site: 'Ask Loki to build and put online a website for you.',
  send_task_to_loki: 'Send one coding task to several of your Loki projects.',
  create_project_for_person:
    'Set up a project for someone without an account, for them to take over.',
  send_to_loki: 'Hand one of your pages to Loki, so it can be built out.',
  update_entity: 'Change one of your products, services, projects, causes or events.',
  publish_entity: 'Make one of your drafts live for everyone to see.',
  archive_entity: 'Take one of your listings down from public view.',
  update_profile: 'Change your public profile: handle, name, bio, location or website.',

  // Posts and messages
  ask_loki: 'Ask Loki what is live, built or waiting in your projects.',
  loki_sessions: 'Read what your Loki agents are working on.',
  project_status: 'Read how your Loki projects are doing and whether their sites are up.',
  loki_run_status: 'Read where one Loki run is: working, merged or live.',
  file_loki_finding: 'Report a problem on one of your live apps to Loki.',
  loki_finding_status: 'Read where a problem you reported to Loki stands.',
  post_to_timeline: 'Post on your public timeline.',
  send_message: 'Send a private message in your name.',
  reply_to_message: 'Reply in a conversation you are already in.',
  follow_user: 'Follow someone, so their posts show up in your feed.',
  unfollow_user: 'Stop following someone.',
  like_post: 'Like a post in your name.',
  comment_on_post: 'Comment on a post in your name, with words you confirmed.',
  request_introduction: 'Start a conversation with someone you found and send your intro.',
  draft_promotion: 'Look up a channel’s posting rules before drafting a post about your work.',

  // Wallets, bookings and payments
  book_service: 'Ask to book someone’s service at a time you choose.',
  accept_booking: 'Confirm a booking request for one of your services.',
  decline_booking: 'Decline a booking request for one of your services.',
  send_payment: 'Send Bitcoin from your wallet to someone else.',
  connect_wallet: 'Save the wallet address you paste, so people can pay you.',
  add_wallet: 'Create a savings goal on a wallet you already have.',
  note_transaction: 'Add your note on what a payment was for.',
  fund_project: 'Send Bitcoin from your wallet to a project.',

  // Organizations
  create_organization: 'Create an organization or group.',
  propose_governance_change: 'Propose new spending limits for Cat, for people to vote on.',
  propose_to_group: 'Put a decision about shared money to a group vote.',
  invite_to_organization: 'Invite someone to join your organization.',

  // Memory and notes
  mark_notifications_read: 'Mark all your notifications as read.',
  publish_interest: 'Add a topic to your public interests, so people can find you by it.',
  unpublish_interest: 'Remove a topic from your public interests.',
  watch_topic: 'Tell you when someone new starts working on a topic.',
  save_economic_profile: 'Remember your skills, goals and things you own, kept private.',
  forget_memories: 'Delete things Cat remembers about you that are wrong.',
  remember_fact: 'Remember something you ask Cat to remember.',
  edit_memory: 'Correct one thing Cat remembers about you.',
  add_context: 'Save a document for Cat to know about.',
  create_task: 'Add a task to your list.',
  complete_task: 'Mark one of your tasks as done.',
  update_task: 'Rename, reschedule or reprioritise one of your tasks.',
  create_watch: 'Tell you when something happens, like a sale or a funding goal reached.',
  cancel_watch: 'Stop one of the alerts Cat set for you.',
  set_reminder: 'Set a reminder for you.',
  set_civic_split: 'Note how you would split your public money between town, region and country.',
  walk_site: 'Open up to three live pages on a phone and say what is wrong. Changes nothing.',
  use_browser: 'Take one step in a browser of its own. Never types passwords or card numbers.',
};

/**
 * The words a person reads for an action: the action's own `summary` where
 * cat-actions.ts has one, else this list, and the model's description only as
 * a last resort.
 */
export function catActionSummary(action: {
  id: string;
  description: string;
  summary?: string;
}): string {
  return action.summary ?? CAT_ACTION_SUMMARIES[action.id] ?? action.description;
}
