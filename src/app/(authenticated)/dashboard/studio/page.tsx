import StudioWorkspace from '@/components/studio/StudioWorkspace';
import { STUDIO_MEDIUMS, STUDIO_PROMPT_LIMITS, isStudioMedium } from '@/config/studio';
import type { StudioMedium } from '@/config/studio';

/**
 * /dashboard/studio — where a creation is MADE, before it becomes a project to
 * finance or a product to sell.
 *
 * Opens empty when a person comes here themselves, or carrying a brief when
 * Cat sent them (ROUTES.DASHBOARD.STUDIO_BRIEF). Cat never renders and never
 * presses the button: it writes the brief, this page shows what it wrote, and
 * the person edits or runs it. That is the whole division of labour — the
 * agent does the work, the portal is where the human sees it and decides.
 */
export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ medium?: string; prompt?: string }>;
}) {
  const { medium, prompt } = await searchParams;

  // Validate rather than trust. The link is normally Cat's, but it is still a
  // URL anyone can type, and an unknown medium or an over-long prompt would
  // fail later as a bare "Invalid request" from the generate route.
  const initialMedium: StudioMedium = medium && isStudioMedium(medium) ? medium : STUDIO_MEDIUMS[0];
  const initialPrompt = (prompt ?? '').slice(0, STUDIO_PROMPT_LIMITS.max);

  return <StudioWorkspace initialMedium={initialMedium} initialPrompt={initialPrompt} />;
}
