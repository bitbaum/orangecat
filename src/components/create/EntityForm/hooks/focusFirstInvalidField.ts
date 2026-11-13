import type { FieldGroup } from '../../types';
import { scrollBehavior } from '@/lib/scroll-behavior';

/**
 * After a failed submit, bring the person to the first field in error.
 *
 * Field errors used to be set and nothing else: on a phone the form is
 * thousands of pixels long and the person stayed at the button, far from any
 * red. Fields render with `id={name}` (FormField), so the first failing field
 * in the form's own order that is on the page is scrolled to the middle of
 * the screen and focused. Returns the name it moved to, if any.
 */
export function focusFirstInvalidField(
  fieldGroups: FieldGroup[],
  invalidFields: string[],
  doc: Document | undefined = typeof document === 'undefined' ? undefined : document
): string | null {
  if (!doc || invalidFields.length === 0) {
    return null;
  }
  const invalid = new Set(invalidFields);
  const ordered = fieldGroups
    .flatMap(group => (group.fields ?? []).map(field => field.name as string))
    .filter(name => invalid.has(name));

  for (const name of ordered) {
    const element = doc.getElementById(name);
    if (!element || element.closest('[hidden], .hidden')) {
      continue;
    }
    element.scrollIntoView?.({ block: 'center', behavior: scrollBehavior() });
    element.focus?.({ preventScroll: true });
    return name;
  }
  return null;
}
