// @vitest-environment jsdom
/** A second tag, and a tag with a space, can be typed (audit, 2026-10-07). */
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { TagsField } from '@/components/create/fields/TagsField';

function Harness({ onTags }: { onTags: (t: string[]) => void }) {
  const [tags, setTags] = useState<string[]>([]);
  return (
    <TagsField
      id="tags"
      value={tags}
      onChange={t => {
        setTags(t);
        onTags(t);
      }}
    />
  );
}

it('keeps the comma and the space while typing', () => {
  const onTags = vi.fn();
  render(<Harness onTags={onTags} />);
  const input = screen.getByRole('textbox') as HTMLInputElement;
  fireEvent.change(input, { target: { value: 'bitcoin,' } });
  expect(input.value).toBe('bitcoin,');
  fireEvent.change(input, { target: { value: 'bitcoin, open source' } });
  expect(input.value).toBe('bitcoin, open source');
  expect(onTags).toHaveBeenLastCalledWith(['bitcoin', 'open source']);
});

it('Enter starts the next tag instead of submitting', () => {
  render(<Harness onTags={() => {}} />);
  const input = screen.getByRole('textbox') as HTMLInputElement;
  fireEvent.change(input, { target: { value: 'art' } });
  const notPrevented = fireEvent.keyDown(input, { key: 'Enter' });
  expect(notPrevented).toBe(false);
  expect(input.value).toBe('art, ');
});
