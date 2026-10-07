import {
  CrewAssignError,
  assignToRole,
  unassignFromRole,
  type EventRole,
} from '@/domain/events/crew';

const role = (over: Partial<EventRole> = {}): EventRole => ({
  id: 'r1',
  event_id: 'e1',
  role_title: 'Bartender',
  quantity: 2,
  engagement_type: 'paid',
  fee_amount: null,
  description: null,
  status: 'open',
  assignee_user_ids: [],
  can_check_in: false,
  ...over,
});

/** A role table of one row; updates are applied and echoed back. */
function table(start: EventRole) {
  let row = start;
  const updates: Array<Record<string, unknown>> = [];
  const chain: Record<string, unknown> = {};
  let pending: Record<string, unknown> | null = null;
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.update = vi.fn((u: Record<string, unknown>) => ((pending = u), updates.push(u), chain));
  chain.maybeSingle = vi.fn(() => {
    if (pending) {
      row = { ...row, ...pending } as EventRole;
      pending = null;
    }
    return Promise.resolve({ data: row, error: null });
  });
  return { client: { from: vi.fn(() => chain) } as never, updates };
}

describe('crew assignment', () => {
  it('adds people until the role is full, then marks it filled', async () => {
    const t = table(role());
    const one = await assignToRole(t.client, 'r1', 'u1');
    expect(one).toMatchObject({ assignee_user_ids: ['u1'], status: 'open' });
    const two = await assignToRole(t.client, 'r1', 'u2');
    expect(two).toMatchObject({ assignee_user_ids: ['u1', 'u2'], status: 'filled' });
  });

  it('refuses one person too many, saying what to do', async () => {
    const t = table(role({ quantity: 1, assignee_user_ids: ['u1'], status: 'filled' }));
    await expect(assignToRole(t.client, 'r1', 'u2')).rejects.toThrow(CrewAssignError);
    await expect(assignToRole(t.client, 'r1', 'u2')).rejects.toThrow(/take someone off first/);
  });

  it('adding the same person twice changes nothing', async () => {
    const t = table(role({ assignee_user_ids: ['u1'] }));
    await assignToRole(t.client, 'r1', 'u1');
    expect(t.updates).toHaveLength(0);
  });

  it('taking someone off reopens the role', async () => {
    const t = table(role({ quantity: 1, assignee_user_ids: ['u1'], status: 'filled' }));
    expect(await unassignFromRole(t.client, 'r1', 'u1')).toMatchObject({
      assignee_user_ids: [],
      status: 'open',
    });
  });
});
