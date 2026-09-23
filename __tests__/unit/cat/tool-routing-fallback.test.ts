import { routeWithFallback } from '@/services/cat/tool-routing-fallback';
import { ToolTurnState } from '@/services/cat/tool-turn-state';

vi.mock('@/services/cat/tool-capability', () => ({
  observedToolVerdict: () => undefined,
  toolPlanForModel: () => ({ sendTools: true }),
}));
const steps = [
  { modelToUse: 'primary', toolEndpoint: 'https://primary.test', toolKey: 'first-key' },
  { modelToUse: 'fallback', toolEndpoint: 'https://fallback.test', toolKey: 'second-key' },
];
it('uses the fallback model with its own endpoint and key after an early provider failure', async () => {
  const run = vi.fn().mockRejectedValueOnce(new Error('429')).mockResolvedValueOnce('draft');
  await expect(routeWithFallback(steps, new ToolTurnState(), run)).resolves.toBe('draft');
  expect(run.mock.calls[1][0]).toEqual(steps[1]);
});
it('never replays a turn with a pending write', async () => {
  const state = new ToolTurnState();
  const run = vi.fn(async () => {
    state.pending = {
      id: 'write',
      type: 'function',
      function: { name: 'create_project', arguments: '{}' },
    };
    throw new Error('unknown outcome');
  });
  await expect(routeWithFallback(steps, state, run)).rejects.toThrow('unknown outcome');
  expect(run).toHaveBeenCalledTimes(1);
});
it('never discards or replays completed work when a later provider call fails', async () => {
  const state = new ToolTurnState();
  const run = vi.fn(async () => {
    state.record(
      { id: 'done', type: 'function', function: { name: 'query_my_data', arguments: '{}' } },
      { role: 'tool', tool_call_id: 'done', content: 'verified' }
    );
    throw new Error('503');
  });
  await expect(routeWithFallback(steps, state, run)).rejects.toThrow('503');
  expect(run).toHaveBeenCalledTimes(1);
  expect(state.completed).toHaveLength(2);
});
it('uses one deadline across the chain', async () => {
  const state = new ToolTurnState();
  const run = vi.fn(async () => {
    state.controller.abort();
    throw new Error('deadline');
  });
  await expect(routeWithFallback(steps, state, run)).rejects.toThrow('deadline');
  expect(run).toHaveBeenCalledTimes(1);
});
