// @vitest-environment jsdom
/**
 * One anatomy per row — avatar, name, @handle, why they are here — and a tap
 * fills the handle. Nothing renders for nobody.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { PeoplePicker } from '@/components/money/PeoplePicker';
import type { FoundPerson } from '@/domain/people/rankPeople';

const people: FoundPerson[] = [
  { id: '1', username: 'lena_m', name: 'Lena Meier', avatarUrl: null, relation: 'following' },
  { id: '2', username: 'fresh', name: null, avatarUrl: null, relation: 'none' },
];

describe('PeoplePicker', () => {
  it('lists each person with their handle and relation, and fills the handle on tap', () => {
    const onPick = vi.fn();
    render(<PeoplePicker people={people} onPick={onPick} />);

    expect(screen.getByRole('list', { name: 'People' })).toBeTruthy();
    expect(screen.getByText('Lena Meier')).toBeTruthy();
    expect(screen.getByText('@lena_m')).toBeTruthy();
    expect(screen.getByText('Following')).toBeTruthy();
    // No name yet: the handle stands in, and a stranger carries no label.
    expect(screen.getAllByText('@fresh')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /Lena Meier/ }));
    expect(onPick).toHaveBeenCalledWith('lena_m');
  });

  it('renders nothing for nobody', () => {
    render(<PeoplePicker people={[]} onPick={() => {}} />);
    expect(screen.queryByRole('list')).toBeNull();
  });
});
