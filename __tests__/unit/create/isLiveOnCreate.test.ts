// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/hooks/useSellerPaymentMethods', () => ({
  useSellerPaymentMethods: () => ({ hasWallet: true }),
}));

import { isLiveOnCreate } from '@/components/create/EntityCreationSuccess';

describe('isLiveOnCreate', () => {
  it('reads the real publish state instead of assuming a draft', () => {
    expect(isLiveOnCreate('ai_assistant', { status: 'active' })).toBe(true);
    expect(isLiveOnCreate('product', { status: 'draft' })).toBe(false);
    expect(isLiveOnCreate('wishlist', { is_active: true })).toBe(true);
    expect(isLiveOnCreate('wishlist', { is_active: false })).toBe(false);
    expect(isLiveOnCreate('group', { is_public: false })).toBe(true);
  });
});
