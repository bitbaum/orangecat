/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PublicEntityOwnerCard from '@/components/public/PublicEntityOwnerCard';
import type { EntityOwner } from '@/lib/entities/fetchEntityOwner';

const owner = (over: Partial<EntityOwner>): EntityOwner =>
  ({
    user_id: 'u1',
    username: null,
    name: null,
    avatar_url: null,
    created_at: null,
    ...over,
  }) as EntityOwner;

describe('PublicEntityOwnerCard', () => {
  it('never prints a minted handle, as a name, an @ line or in the ask button', () => {
    render(
      <PublicEntityOwnerCard
        owner={owner({ username: 'user_f735e0fa6035', name: 'user_f735e0fa6035' })}
        label="Provider"
        inquiry={{ title: 'DJ set', path: '/services/s1' }}
      />
    );
    expect(document.body.textContent).not.toMatch(/user_f735e0fa6035/);
    expect(screen.getByText('Ask the seller about this')).toBeTruthy();
    // The link still reaches the real profile.
    expect(document.querySelector('a[href="/profiles/user_f735e0fa6035"]')).toBeTruthy();
  });

  it('prints a chosen name and handle', () => {
    render(
      <PublicEntityOwnerCard owner={owner({ username: 'cato', name: 'Cato' })} label="Seller" />
    );
    expect(screen.getByText('Cato')).toBeTruthy();
    expect(screen.getByText('@cato')).toBeTruthy();
  });
});
