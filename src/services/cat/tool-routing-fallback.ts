import { observedToolVerdict, toolPlanForModel } from './tool-capability';
import type { ToolTurnState } from './tool-turn-state';

export type ToolRoutingStep = {
  modelToUse: string;
  toolEndpoint?: string | null;
  toolKey?: string | null;
};

/** Fail over only before execution begins: replaying an uncertain write is unsafe. */
export async function routeWithFallback<T>(
  steps: ToolRoutingStep[],
  state: ToolTurnState,
  run: (step: ToolRoutingStep & { toolEndpoint: string; toolKey: string }) => Promise<T>
): Promise<T> {
  let lastError: unknown = new Error('No tool-capable provider available');
  for (const step of steps) {
    state.controller.signal.throwIfAborted();
    if (!step.toolEndpoint || !step.toolKey) {
      continue;
    }
    if (
      !toolPlanForModel(step.modelToUse, observedToolVerdict(step.modelToUse, step.toolKey))
        .sendTools
    ) {
      continue;
    }
    try {
      return await run({ ...step, toolEndpoint: step.toolEndpoint, toolKey: step.toolKey });
    } catch (error) {
      if (state.pending || state.completed.length || state.controller.signal.aborted) {
        throw error;
      }
      lastError = error;
    }
  }
  throw lastError;
}
