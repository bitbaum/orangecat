/**
 * The one query parameter that hands a sentence to the Cat.
 *
 * `/dashboard/cat?q=…` auto-sends the sentence into an empty conversation
 * (ModernChatPanel). The door, the profile's "ask about this" links and the
 * map all build that URL; this is the parameter's only spelling.
 */
export const CAT_QUERY_PARAM = 'q';

/** The sentences the door offers as examples — real things it can do today. */
export const DOOR_EXAMPLES = [
  'Sell my old bike',
  'Raise money for the school roof',
  'Lend a friend 500 for two months',
  'Start a fund for Witikon',
] as const;
