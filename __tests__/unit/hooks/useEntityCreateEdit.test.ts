// @vitest-environment jsdom
/**
 * Unit tests for useEntityCreateEdit — the shared hook behind every
 * entity create page that implements the SSOT edit convention
 * (`createPath?edit=<id>` → fetch entity → prefill the same form).
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useEntityCreateEdit } from '@/hooks/useEntityCreateEdit';

let searchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
}));

const mockAuth: { user: { id: string } | null; hydrated: boolean } = {
  user: { id: 'user-1' },
  hydrated: true,
};
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockAuth,
}));

const mockPrefill: { initialData: Record<string, unknown> | undefined } = {
  initialData: undefined,
};
vi.mock('@/hooks/useCreatePrefill', () => ({
  useCreatePrefill: vi.fn(() => mockPrefill),
}));

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { useCreatePrefill } from '@/hooks/useCreatePrefill';

describe('useEntityCreateEdit', () => {
  afterEach(() => {
    vi.clearAllMocks();
    searchParams = new URLSearchParams();
    mockPrefill.initialData = undefined;
  });

  it('create mode (no ?edit): no fetch, prefill enabled, not loading', async () => {
    global.fetch = vi.fn() as unknown as typeof fetch;
    mockPrefill.initialData = { title: 'From Cat' };

    const { result } = renderHook(() => useEntityCreateEdit('cause'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.editId).toBeNull();
    expect(result.current.entityData).toBeNull();
    expect(result.current.initialData).toEqual({ title: 'From Cat' });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(useCreatePrefill).toHaveBeenCalledWith({ entityType: 'cause', enabled: true });
  });

  it('edit mode: fetches `${apiEndpoint}/${id}` and exposes the entity for prefill', async () => {
    searchParams = new URLSearchParams('edit=cause-1');
    const row = { id: 'cause-1', title: 'Clean water', target_amount: 500 };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: row }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useEntityCreateEdit('cause'));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(global.fetch).toHaveBeenCalledWith('/api/causes/cause-1', {
      credentials: 'same-origin',
    });
    expect(result.current.editId).toBe('cause-1');
    expect(result.current.entityData).toEqual(row);
    expect(result.current.editError).toBeNull();
    // URL/localStorage prefill must be disabled in edit mode
    expect(useCreatePrefill).toHaveBeenCalledWith({ entityType: 'cause', enabled: false });
  });

  it('edit mode uses the registry apiEndpoint per entity type', async () => {
    searchParams = new URLSearchParams('edit=g-1');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { id: 'g-1', name: 'DAO' } }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useEntityCreateEdit('group'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(global.fetch).toHaveBeenCalledWith('/api/groups/g-1', {
      credentials: 'same-origin',
    });
    expect(result.current.entityData).toEqual({ id: 'g-1', name: 'DAO' });
  });

  it('edit mode: 404 → "not found" edit error, no entity data', async () => {
    searchParams = new URLSearchParams('edit=missing');
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ success: false }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useEntityCreateEdit('cause'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.editError).toBe('Cause not found');
    expect(result.current.entityData).toBeNull();
  });

  it('edit mode waits for auth hydration before fetching', () => {
    searchParams = new URLSearchParams('edit=cause-1');
    mockAuth.hydrated = false;
    global.fetch = vi.fn() as unknown as typeof fetch;

    const { result } = renderHook(() => useEntityCreateEdit('cause'));

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(true);
    mockAuth.hydrated = true;
  });
});
