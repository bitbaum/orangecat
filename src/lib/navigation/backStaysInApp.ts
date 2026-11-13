/**
 * Whether the browser's Back would land on another page of this site.
 *
 * A page opened fresh — a new tab, a bookmark, orangecat.ch typed in, a link
 * from somewhere else — has nothing of ours behind it, and `router.back()`
 * there leaves the site (on a phone, to a blank tab). A Back control that
 * gets false here should go somewhere in the app instead.
 *
 * The Navigation API answers exactly this: its entries are the same-origin
 * ones, so `canGoBack` is false when the entry behind is another site or there
 * is none. Where it is missing, a history entry behind this one plus a
 * same-origin referrer is the signal we have; an empty referrer (typed URL,
 * new tab) counts as "not ours", which errs towards staying in the app.
 */
export function backStaysInApp(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const navigation = (window as Window & { navigation?: { canGoBack?: unknown } }).navigation;
  if (typeof navigation?.canGoBack === 'boolean') {
    return navigation.canGoBack;
  }
  if (window.history.length <= 1) {
    return false;
  }
  try {
    return new URL(document.referrer).origin === window.location.origin;
  } catch {
    return false;
  }
}
