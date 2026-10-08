'use client';

import { useState } from 'react';
import Textarea from '@/components/ui/Textarea';

/**
 * A list edited as lines. It keeps its OWN text while you type and hands the
 * parsed list up: deriving the text back from the list on every keystroke
 * would drop the empty line Enter just made, and Enter would seem to do
 * nothing. Remount it (a `key` per slide) to load another slide's list.
 */
export function LinesField({
  label,
  initial,
  rows = 5,
  onCommit,
}: {
  label: string;
  initial: string;
  rows?: number;
  onCommit: (text: string) => void;
}) {
  const [text, setText] = useState(initial);
  return (
    <Textarea
      label={label}
      rows={rows}
      value={text}
      onChange={e => {
        setText(e.target.value);
        onCommit(e.target.value);
      }}
    />
  );
}
