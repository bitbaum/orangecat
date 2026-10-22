// @vitest-environment jsdom
/**
 * A name is found, not spelled: the list under the field shows people from
 * the shared search, and tapping one fills the handle.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import type { Mock } from 'vitest';

vi.mock('@/hooks/useGlobalSearch', () => ({ useGlobalSearch: vi.fn() }));

import { PeopleSuggestions } from '@/components/money/PeopleSuggestions';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';

const search = useGlobalSearch as Mock;

const hit = (over: Partial<Record<string, unknown>>) => ({
  type: 'profile',
  id: 'p1',
  title: 'Cato',
  snippet: '',
  imageUrl: null,
  href: '/profiles/cato',
  amount: null,
  currency: null,
  startsAt: null,
  place: null,
  createdAt: null,
  handle: 'cato',
  rank: 1,
  marks: { title: [], snippet: [] },
  typos: 0,
  ...over,
});

describe('PeopleSuggestions', () => {
  it('lists people only, and fills the handle on tap', () => {
    search.mockReturnValue({
      results: [hit({}), hit({ id: 'x', type: 'project', title: 'Cato Project', handle: null })],
      total: 2,
      loading: false,
    });
    const onPick = vi.fn();
    render(<PeopleSuggestions query="cat" enabled onPick={onPick} />);

    expect(screen.getByText('Cato')).toBeTruthy();
    expect(screen.queryByText('Cato Project')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Cato/ }));
    expect(onPick).toHaveBeenCalledWith('cato');
    expect(search).toHaveBeenLastCalledWith('cat', true, 12);
  });

  it('shows nothing once the handle is typed in full, or when disabled', () => {
    search.mockReturnValue({ results: [hit({})], total: 1, loading: false });
    const { rerender } = render(<PeopleSuggestions query="cato" enabled onPick={() => {}} />);
    expect(screen.queryByRole('list')).toBeNull();
    rerender(<PeopleSuggestions query="cat" enabled={false} onPick={() => {}} />);
    expect(screen.queryByRole('list')).toBeNull();
  });
});
