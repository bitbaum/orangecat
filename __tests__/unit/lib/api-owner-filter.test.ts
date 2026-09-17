/**
 * resolveOwnerFilter — the owner filter of a list endpoint.
 *
 * Regression under test (observed on prod 2026-08-06): GET /api/projects read
 * only `?user_id=`, so `?username=<anything>` was silently ignored and the
 * caller got the FULL public list back. A filter that cannot be honoured must
 * narrow the result to nothing, never widen it to everything.
 */
import { resolveOwnerFilter } from '@/lib/api/query';

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from '@/lib/supabase/server';

import type { MockedFunction } from 'vitest';

const mockedCreateServerClient = createServerClient as MockedFunction<typeof createServerClient>;

/** Minimal stub of the one query resolveOwnerFilter makes. */
function stubProfileLookup(result: { id: string } | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: result, error: null });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  mockedCreateServerClient.mockResolvedValue({ from } as never);
  return { from, select, eq, maybeSingle };
}

const URL_BASE = 'https://orangecat.ch/api/projects';

describe('resolveOwnerFilter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns no filter when neither param is present', async () => {
    const stub = stubProfileLookup(null);
    await expect(resolveOwnerFilter(URL_BASE)).resolves.toEqual({
      userId: undefined,
      unresolved: false,
    });
    // An unfiltered list must not cost a profile lookup.
    expect(stub.from).not.toHaveBeenCalled();
  });

  it('passes through an explicit user_id without a lookup', async () => {
    const stub = stubProfileLookup(null);
    await expect(resolveOwnerFilter(`${URL_BASE}?user_id=abc-123`)).resolves.toEqual({
      userId: 'abc-123',
      unresolved: false,
    });
    expect(stub.from).not.toHaveBeenCalled();
  });

  it('resolves a known username to its user id', async () => {
    const stub = stubProfileLookup({ id: 'cec88bc9' });
    await expect(resolveOwnerFilter(`${URL_BASE}?username=mao`)).resolves.toEqual({
      userId: 'cec88bc9',
      unresolved: false,
    });
    expect(stub.eq).toHaveBeenCalledWith('username', 'mao');
  });

  // The actual bug: this used to fall through to "no filter", which the list
  // endpoint reads as "return everything".
  it('reports an unknown username as unresolved, NOT as an absent filter', async () => {
    stubProfileLookup(null);
    await expect(resolveOwnerFilter(`${URL_BASE}?username=nobody-here`)).resolves.toEqual({
      userId: undefined,
      unresolved: true,
    });
  });

  it('never lets an unknown owner look like an unfiltered request', async () => {
    stubProfileLookup(null);
    const unknown = await resolveOwnerFilter(`${URL_BASE}?username=nobody-here`);
    const none = await resolveOwnerFilter(URL_BASE);
    // Both have userId undefined — `unresolved` is the only thing that keeps
    // them apart, so it must differ.
    expect(unknown.userId).toBe(none.userId);
    expect(unknown.unresolved).not.toBe(none.unresolved);
  });

  it('prefers user_id when both are supplied', async () => {
    const stub = stubProfileLookup({ id: 'from-username' });
    await expect(resolveOwnerFilter(`${URL_BASE}?user_id=from-uuid&username=mao`)).resolves.toEqual(
      { userId: 'from-uuid', unresolved: false }
    );
    expect(stub.from).not.toHaveBeenCalled();
  });

  it('treats a blank username as no filter, not as an unknown owner', async () => {
    const stub = stubProfileLookup(null);
    await expect(resolveOwnerFilter(`${URL_BASE}?username=%20%20`)).resolves.toEqual({
      userId: undefined,
      unresolved: false,
    });
    expect(stub.from).not.toHaveBeenCalled();
  });

  it('trims a padded username before looking it up', async () => {
    const stub = stubProfileLookup({ id: 'cec88bc9' });
    await resolveOwnerFilter(`${URL_BASE}?username=%20mao%20`);
    expect(stub.eq).toHaveBeenCalledWith('username', 'mao');
  });
});
