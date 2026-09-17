// @vitest-environment jsdom
/**
 * A busy button has to keep saying which action is busy.
 *
 * It used to replace every caller's label with a generic "Loading...", so a
 * button that said "Sending…" while a payment was in flight became indistinct
 * from one saving a draft — losing exactly the word the user needed at the most
 * anxious moment in the product.
 */

import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/Button';

describe('Button while loading', () => {
  it('keeps the caller label instead of overwriting it', () => {
    render(<Button isLoading>Sending…</Button>);

    expect(screen.getByRole('button')).toHaveTextContent('Sending…');
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('falls back to a generic label only when there is nothing to keep', () => {
    render(<Button isLoading />);

    expect(screen.getByRole('button')).toHaveTextContent('Loading...');
  });

  it('blocks a second click while the first is still running', () => {
    render(<Button isLoading>Send payment</Button>);

    expect(screen.getByRole('button')).toBeDisabled();
  });
});
