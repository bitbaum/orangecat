'use client';

import { useRaiseFlow } from '@/hooks/useRaiseFlow';
import { DoneStep } from './DoneStep';
import { NeedStep } from './NeedStep';
import { PlanStep } from './PlanStep';

/**
 * "I need A, it costs B" → a live page that raises B. Three screens: say it,
 * check the plan the Cat priced, share the link.
 */
export function RaiseFlow() {
  const flow = useRaiseFlow();
  if (flow.step === 'done' && flow.published) {
    return <DoneStep flow={flow} />;
  }
  if ((flow.step === 'plan' || flow.step === 'publishing') && flow.plan) {
    return <PlanStep flow={flow} />;
  }
  return <NeedStep flow={flow} />;
}
