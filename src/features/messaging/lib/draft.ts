/**
 * A message typed FOR the user, waiting in a conversation's composer — never
 * sent on their behalf. Used when a buyer taps "Ask about this" on a listing:
 * the conversation opens with the listing already named, and they add their
 * question. Session-scoped and read once.
 */

const key = (conversationId: string) => `oc:message-draft:${conversationId}`;

export function stashMessageDraft(conversationId: string, text: string): void {
  try {
    window.sessionStorage.setItem(key(conversationId), text);
  } catch {
    /* storage unavailable: the composer simply opens empty */
  }
}

export function takeMessageDraft(conversationId: string): string | null {
  try {
    const text = window.sessionStorage.getItem(key(conversationId));
    if (text !== null) {
      window.sessionStorage.removeItem(key(conversationId));
    }
    return text;
  } catch {
    return null;
  }
}

/** The opening line of an inquiry about a listing. */
export function inquiryDraft(title: string, url: string): string {
  return `Hi! I have a question about “${title}” (${url}): `;
}
