/**
 * The model a person chose for one bot's chat, kept on this device.
 * Read when a message is sent, written by the row in the bot's details.
 */

const key = (assistantId: string) => `oc.bot.model.${assistantId}`;
/** A model id as providers write them (services/ai/own-models.ts, isModelId). */
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/;

export function readChosenModel(assistantId: string): string | null {
  try {
    const stored = window.localStorage.getItem(key(assistantId));
    return stored && MODEL_ID.test(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function writeChosenModel(assistantId: string, model: string | null): void {
  try {
    if (model && MODEL_ID.test(model)) {
      window.localStorage.setItem(key(assistantId), model);
    } else {
      window.localStorage.removeItem(key(assistantId));
    }
  } catch {
    // Private mode or a full store: the choice lasts for this page only.
  }
}
