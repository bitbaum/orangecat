import { useEffect, useState } from 'react';

/**
 * The palette's highlighted row — the one Enter takes — as controlled cmdk
 * state. It starts on the first row shown and moves back there whenever that
 * first row changes; arrows and the pointer move it in between.
 *
 * cmdk on its own picks a first row only when the typed text changes. Public
 * results land a moment after the last keystroke and render ABOVE "Ask your
 * Cat", so the highlight stayed on the Cat row and Enter sent the name the
 * person had just found to the Cat as a message.
 *
 * `rows` lists each group's first row value in the order the palette renders
 * them; a group that shows nothing passes a falsy value. So does "Ask your
 * Cat" while everyone's results are still on their way — it renders disabled
 * then, so a name typed and entered at once never becomes a message to the Cat.
 */
export function useLeadRow(rows: ReadonlyArray<string | false | null | undefined>) {
  const first = rows.find(Boolean) || '';
  const [active, setActive] = useState(first);
  useEffect(() => setActive(first), [first]);
  return [active, setActive] as const;
}
