/**
 * Ask the Cat something from outside its composer.
 *
 * The chat panel owns sending; controls that live beside it (the toolbar's
 * Loki sheet, for one) dispatch this event with the words, and the panel sends
 * them as if typed — one send path, so quota, history and pending actions all
 * behave the same.
 */
export const CAT_SEND_EVENT = 'oc:cat-send';

export function askCat(text: string): void {
  window.dispatchEvent(new CustomEvent<string>(CAT_SEND_EVENT, { detail: text }));
}
