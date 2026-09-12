/**
 * Can THIS model drive the tool loop?
 *
 * Replaces `providerSupportsNativeTools(providerId)`, which asked about the
 * PROVIDER and answered from a list of two names. That list was wrong in both
 * directions at once: it denied tools to every user who brought their own
 * OpenAI, Together, DeepSeek or xAI key — models that all speak OpenAI-style
 * function calling, and whose owners are paying for exactly that — while
 * claiming nothing about the free models that answer tools only in prose.
 *
 * The rules live in `@bitbaum/ai-kit/capability`. What lives here is the one
 * OrangeCat-specific decision: how to read our own model registry as a PRIOR.
 *
 * ## The trap this file exists to avoid
 *
 * `config/ai-models.ts` flags `function_calling` per model. The tempting
 * implementation reads "no flag" as "no tools" — and that reproduces the whole
 * bug one layer down. The registry is incomplete by construction: it is a
 * hand-maintained list of models we happened to catalogue, and a user can
 * bring one nobody here has heard of. Reading its silence as a denial would
 * permanently refuse tools to every such model WITHOUT EVER ASKING, which is
 * precisely what the provider list did.
 *
 * So absence means `unobserved`, never `none`. A registry says where to start,
 * never where to stop. Only a real answer from a real model may produce a
 * negative, and that lives in the observation layer.
 */
import { planToolAttempt, type ToolPlan, type ToolVerdict } from '@bitbaum/ai-kit/capability';
import { getModelMetadata } from '@/config/ai-models';

/**
 * What our registry CLAIMS about a model's tool support.
 *
 * Returns only `native` or `unobserved` — deliberately never `none`. See the
 * header: silence from an incomplete list is not a denial.
 */
export function declaredToolVerdict(modelId: string | null | undefined): ToolVerdict {
  if (!modelId) {
    return 'unobserved';
  }
  const meta = getModelMetadata(modelId);
  if (!meta) {
    // A model we have never catalogued. Almost certainly a BYOK user's own
    // choice, and almost certainly capable — but we do not know, so we ask.
    return 'unobserved';
  }
  return meta.capabilities.includes('function_calling') ? 'native' : 'unobserved';
}

/**
 * Decide what to send this model.
 *
 * `observed` is threaded through for when the observation store lands; until
 * then every model is `unobserved`, which means "ask" — and asking is how a
 * model that nobody catalogued gets its tools.
 */
export function toolPlanForModel(
  modelId: string | null | undefined,
  observed: ToolVerdict = 'unobserved'
): ToolPlan {
  return planToolAttempt({ observed, declared: declaredToolVerdict(modelId) });
}
