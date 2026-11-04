import { CAT_MENTION } from '@/config/cat-identity';

/**
 * Puts "@cat " at the start of the composer (once) and focuses it, through the
 * native value setter + an input event so React's controlled state follows.
 * Tagging @cat in a conversation is how Cat joins it (noteCatMention); the
 * button just makes that discoverable.
 */
export function insertCatMention(el: HTMLTextAreaElement | null): void {
  if (!el) {
    return;
  }
  const current = el.value;
  if (!current.toLowerCase().includes(CAT_MENTION.toLowerCase())) {
    const next = `${CAT_MENTION} ${current}`.replace(/\s+$/, ' ');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    setter?.call(el, next);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  el.focus();
  el.setSelectionRange(el.value.length, el.value.length);
}
