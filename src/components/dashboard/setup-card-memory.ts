/**
 * Whether the dashboard's setup card showed last time, per account, on this
 * device. While recommendations load, the dashboard reserves the card's space
 * only when it expects the card: a new account (nothing remembered) gets the
 * placeholder, so the card arriving does not push the column down; an account
 * whose setup is done gets nothing, so a placeholder does not collapse either.
 */

const KEY_PREFIX = 'oc_setup_card_shown_';

export function expectSetupCard(userId: string | undefined): boolean {
  if (!userId) {
    return true;
  }
  try {
    return localStorage.getItem(`${KEY_PREFIX}${userId}`) !== 'false';
  } catch {
    return true;
  }
}

export function rememberSetupCard(userId: string, shown: boolean): void {
  try {
    localStorage.setItem(`${KEY_PREFIX}${userId}`, shown ? 'true' : 'false');
  } catch {
    // A device preference must not stop the dashboard from opening.
  }
}
