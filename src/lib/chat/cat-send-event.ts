/**
 * Ask the Cat something from outside its composer.
 *
 * The chat panel owns sending; controls that live beside it (the toolbar's
 * Loki sheet, for one) dispatch this event with the words, and the panel sends
 * them as if typed — one send path, so quota, history and pending actions all
 * behave the same.
 *
 * `send: false` only puts the words in the box for the person to finish. A
 * template ("Send this task to my Loki projects: ") used to be sent as it
 * stood, unfinished, spending one of the day's free messages.
 */
export const CAT_SEND_EVENT = 'oc:cat-send';

export interface CatSendDetail {
  text: string;
  send: boolean;
}

export function askCat(text: string, options: { send?: boolean } = {}): void {
  window.dispatchEvent(
    new CustomEvent<CatSendDetail>(CAT_SEND_EVENT, {
      detail: { text, send: options.send ?? true },
    })
  );
}
