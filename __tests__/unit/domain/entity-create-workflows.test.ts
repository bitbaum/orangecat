import { createProject } from '@/domain/projects/service';
import { createProduct, createCause } from '@/domain/commerce/service';

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/services/actors/getOrCreateUserActor', () => ({
  getOrCreateUserActor: vi.fn().mockResolvedValue({ id: 'a1' }),
}));

import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

import type { Mock } from 'vitest';

describe('Entity create workflows (project/product/cause)', () => {
  const mockServerChain = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn(),
  };

  const mockAdminChain = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn(),
  };

  const mockServerClient = {
    from: vi.fn(() => mockServerChain),
  };

  const mockAdminClient = {
    from: vi.fn(() => mockAdminChain),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createServerClient as Mock).mockResolvedValue(mockServerClient);
    (createAdminClient as Mock).mockReturnValue(mockAdminClient);
  });

  it('creates a project with draft defaults and CHF currency fallback', async () => {
    const created = { id: 'proj-1', title: 'P', status: 'draft' };
    mockServerChain.single.mockResolvedValue({ data: created, error: null });

    const result = await createProject('user-1', {
      title: 'P',
      description: 'project desc',
      category: 'technology',
    });

    expect(mockServerClient.from).toHaveBeenCalledWith('projects');
    expect(mockServerChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_id: 'a1',
        title: 'P',
        status: 'draft',
        currency: 'CHF',
      })
    );
    expect(result).toEqual(created);
  });

  it('creates a product with required defaults', async () => {
    const created = { id: 'prod-1', title: 'Prod', status: 'draft' };
    mockAdminChain.single.mockResolvedValue({ data: created, error: null });

    const result = await createProduct('user-2', {
      title: 'Prod',
      price: 1000,
    });

    expect(mockAdminClient.from).toHaveBeenCalledWith('user_products');
    expect(mockAdminChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_id: 'a1',
        title: 'Prod',
        price: 1000,
        status: 'draft',
        currency: 'CHF',
        product_type: 'physical',
      })
    );
    expect(result).toEqual(created);
  });

  it('creates a cause with safe defaults', async () => {
    const created = { id: 'cause-1', title: 'Cause', status: 'draft' };
    mockAdminChain.single.mockResolvedValue({ data: created, error: null });

    const result = await createCause('user-3', {
      title: 'Cause',
      cause_category: 'charity',
      lightning_address: '',
    });

    expect(mockAdminClient.from).toHaveBeenCalledWith('user_causes');
    expect(mockAdminChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_id: 'a1',
        title: 'Cause',
        cause_category: 'charity',
        status: 'draft',
        total_raised: 0,
      })
    );
    expect(result).toEqual(created);
  });
});
