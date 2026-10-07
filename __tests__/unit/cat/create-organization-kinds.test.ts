/**
 * A word the model made up ("bar", "party crew") never becomes a group kind —
 * it used to be stored as the label, which no screen knows how to show.
 */

import { organizationHandlers } from '@/services/cat/handlers/organization';

function mockSupabase() {
  const inserts: Array<Record<string, unknown>> = [];
  const chain: Record<string, unknown> = {};
  chain.insert = vi.fn((row: Record<string, unknown>) => (inserts.push(row), chain));
  chain.select = vi.fn(() => chain);
  chain.single = vi.fn(() =>
    Promise.resolve({ data: { id: 'g-1', ...inserts.at(-1) }, error: null })
  );
  return { client: { from: vi.fn(() => chain) } as never, inserts };
}

describe('create_organization — kinds', () => {
  it('keeps a real kind as asked and falls back to circle for an invented one', async () => {
    const { client, inserts } = mockSupabase();
    const run = (params: Record<string, unknown>) =>
      organizationHandlers.create_organization(client, 'user-1', 'actor-1', params);
    await run({ name: 'Builders', type: 'guild' });
    const out = await run({ name: 'Friends', type: 'party crew' });
    expect(inserts.map(r => r.label)).toEqual(['guild', 'circle']);
    expect((out.data as { displayMessage: string }).displayMessage).toContain('"Friends" created');
  });
});
