// @vitest-environment jsdom
/**
 * The `@` menu, driven through a real textarea.
 *
 * The pure tests in `domain/mention-autocomplete.test.ts` prove the rules. They
 * cannot prove the WIRING — that a keystroke reaches the parser, that the caret
 * is read from the right place, that picking a row writes the handle back into
 * the field. That plumbing is where this feature can be quietly dead while every
 * unit test passes, so it gets driven end to end here: type into a textarea,
 * read the menu that appears, press keys, and check what ends up in the field.
 *
 * The Cat's presence at the top is asserted from the RENDERED menu rather than
 * from the ranking function, because "nobody discovers @cat by guessing" is only
 * fixed if it is on screen.
 */

import React, { useRef, useState } from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MentionSuggestions from '@/components/mentions/MentionSuggestions';
import { textareaSurface } from '@/components/mentions/caret';
import { useMentionAutocomplete, __resetCatProfileCache } from '@/hooks/useMentionAutocomplete';

const CAT = { id: 'cat-id', username: 'cat', name: 'Cat', avatar_url: null };
const PEOPLE = [
  { id: 'p1', username: 'carla', name: 'Carla', avatar_url: null },
  { id: 'p2', username: 'dan', name: 'Dan', avatar_url: null },
];

/** Stand in for /api/profiles, answering the way the real endpoint does. */
function mockProfiles(rows: (search: string) => unknown[]) {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const search = decodeURIComponent(
      new URL(url, 'http://localhost').searchParams.get('search') ?? ''
    );
    return {
      ok: true,
      json: async () => ({ success: true, data: rows(search) }),
    } as Response;
  }) as unknown as typeof fetch;
}

function Harness() {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState('');
  const mentions = useMentionAutocomplete({ surface: textareaSurface(ref) });

  return (
    <div>
      <MentionSuggestions
        items={mentions.items}
        activeIndex={mentions.activeIndex}
        onPick={mentions.pick}
        onHover={mentions.setActiveIndex}
      />
      <textarea
        ref={ref}
        aria-label="message"
        value={value}
        onChange={e => {
          setValue(e.target.value);
          mentions.refresh();
        }}
        onKeyDown={e => mentions.handleKeyDown(e)}
      />
    </div>
  );
}

beforeEach(() => {
  __resetCatProfileCache();
  mockProfiles(search =>
    search === 'cat'
      ? [CAT]
      : [...PEOPLE, CAT].filter(p => p.username.startsWith(search) || search === '')
  );
});

afterEach(() => vi.restoreAllMocks());

describe('typing @ in a composer', () => {
  it('offers the Cat first, on the very first @ typed', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText('message'), '@');

    const options = await screen.findAllByRole('option');
    expect(options[0]).toHaveTextContent('Cat');
    expect(options[0]).toHaveTextContent('@cat');
  });

  it('narrows as you type, and keeps the Cat while it still matches', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText('message'), 'hey @ca');

    // The Cat is on screen before the people search comes back — its profile is
    // cached for the page, so the row people need to discover never waits on a
    // request. Wait for a person to arrive before comparing the two.
    await screen.findByText('@carla');
    expect(screen.getAllByRole('option')[0]).toHaveTextContent('@cat');
  });

  it('drops the Cat once the query no longer matches it', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText('message'), '@dan');

    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(0));
    expect(screen.queryByText('@cat · ask about this thread')).not.toBeInTheDocument();
  });

  it('shows nothing for an email address', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText('message'), 'write to bob@exa');

    // Give the debounce a chance to fire, so this is not passing merely because
    // the assertion ran first.
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('Enter picks the highlighted row and writes the handle into the field', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const field = screen.getByLabelText('message') as HTMLTextAreaElement;

    await user.type(field, 'hey @ca');
    await waitFor(() => expect(screen.getAllByRole('option')[0]).toHaveTextContent('@cat'));
    await user.keyboard('{Enter}');

    // Trailing space: the mention is finished and the caret is where the next
    // word goes, so choosing from the menu costs no extra keystroke.
    await waitFor(() => expect(field.value).toBe('hey @cat '));
  });

  it('arrow keys move the highlight, so Enter can pick a person instead', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const field = screen.getByLabelText('message') as HTMLTextAreaElement;

    await user.type(field, 'hey @ca');
    await screen.findByText('@carla');
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(field.value).toBe('hey @carla '));
  });

  it('Escape closes the menu and leaves the typed text alone', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const field = screen.getByLabelText('message') as HTMLTextAreaElement;

    await user.type(field, 'hey @ca');
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(0));
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(0));
    expect(field.value).toBe('hey @ca');
  });
});
