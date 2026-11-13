// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { emptyStateWithCreate } from '@/components/entity/emptyStateWithCreate';
import { wishlistEntityConfig } from '@/config/entities/wishlists';
import { circleEntityConfig } from '@/config/entities/circles';

describe('entity list empty states end in the way to make one', () => {
  it.each([
    ['wishlists', wishlistEntityConfig],
    ['circles', circleEntityConfig],
  ])('%s gets a Create button to its create page', (_name, config) => {
    const state = emptyStateWithCreate(config.emptyState, config);
    render(<>{state?.action}</>);
    expect(screen.getByRole('link', { name: `Create ${config.name}` })).toHaveAttribute(
      'href',
      config.createPath
    );
  });

  it('uses the page label when there is one', () => {
    const state = emptyStateWithCreate(
      { title: 'None' },
      { createPath: '/x', name: 'Loan' },
      'Add a loan'
    );
    render(<>{state?.action}</>);
    expect(screen.getByRole('link', { name: 'Add a loan' })).toHaveAttribute('href', '/x');
  });

  it('leaves an action the config chose itself', () => {
    const own = <button type="button">Browse</button>;
    expect(
      emptyStateWithCreate({ title: 'None', action: own }, { createPath: '/x', name: 'Loan' })
        ?.action
    ).toBe(own);
  });
});
