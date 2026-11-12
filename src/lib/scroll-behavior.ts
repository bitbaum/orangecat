/**
 * The `behavior` for a scripted scroll.
 *
 * A `behavior` passed to scrollTo or scrollIntoView overrides the stylesheet,
 * so the `prefers-reduced-motion` rule in globals.css cannot reach it. Every
 * scripted scroll asks here instead of writing 'smooth'.
 */
export function scrollBehavior(): ScrollBehavior {
  const reduce =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return reduce ? 'instant' : 'smooth';
}
