import { createHealthTracker } from '@bitbaum/ai-kit';

// Observed answer readiness, separate from web/database liveness. Do not put
// provider error bodies or private conversation content in a public endpoint.
const tracker = createHealthTracker({ downAfter: 3 });
export const recordCatCompletionSuccess = () => tracker.recordSuccess();
export const recordCatCompletionFailure = () =>
  tracker.recordFailure(new Error('Completion failed'));
export const getCatCompletionHealth = () => tracker.getHealth();
