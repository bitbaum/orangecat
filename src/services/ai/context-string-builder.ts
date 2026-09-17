import type { FullUserContext } from './document-context-types';
import {
  renderCurrentSession,
  renderMemories,
  renderDateTime,
  renderProfile,
  renderEconomicProfile,
  renderTrackRecord,
  renderDocuments,
  renderEntities,
  renderGroupMemberships,
  renderSocialGraph,
  renderProjectActivity,
  renderStakeholders,
  renderGithubRepos,
  renderStudioMap,
  renderTasks,
  renderWallets,
  renderConversations,
  renderNotifications,
  renderInboundActivity,
  renderPaymentCapabilities,
  renderActivitySummary,
} from './context-sections';

/**
 * Build the Cat user-context string fed to the model each turn. Sections are
 * rendered in PRIORITY ORDER (session first so Cat can scope everything, then
 * profile/documents/entities/…/activity summary). Each renderer lives in
 * context-sections.ts and returns its block or null; we keep the non-null ones,
 * budget greedily so the highest-priority sections survive, then wrap.
 *
 * Section wording/format is byte-identical to before the SoC split — guarded by
 * context-string-builder.snapshot.test.ts. Change wording in context-sections.ts.
 */
export function buildFullContextString(context: FullUserContext): string {
  const locale = context.runtime?.locale || 'en-US';

  const sections = [
    renderCurrentSession(context.runtime),
    renderMemories(context.memories),
    renderDateTime(locale),
    renderProfile(context.profile),
    renderEconomicProfile(context.economicProfile),
    renderTrackRecord(context.trackRecord),
    renderDocuments(context.documents),
    renderEntities(context.entities),
    renderGroupMemberships(context.memberGroups),
    renderSocialGraph(context.socialGraph),
    renderProjectActivity(context.projectActivity),
    renderStakeholders(context.stakeholders),
    renderGithubRepos(context.githubRepos),
    renderStudioMap(context.studioMap),
    renderTasks(context.tasks, locale),
    renderWallets(context.wallets),
    renderConversations(context.conversations),
    renderNotifications(context.notifications, locale),
    renderInboundActivity(context.inboundActivity, locale),
    renderPaymentCapabilities(context.paymentCapabilities),
    renderActivitySummary(context.stats),
  ].filter((s): s is string => s !== null);

  if (sections.length === 0) {
    return '';
  }

  // Budget the context so it can't overflow the model window or drown a small
  // free model on large accounts. Sections are pushed in priority order
  // (session → profile → documents → entities → … → activity summary), so we
  // greedily keep the highest-priority ones that fit and note any omission.
  // ~28k chars ≈ ~7k tokens — leaves ample room for the system prompt + history.
  const CONTEXT_CHAR_BUDGET = 28000;
  const SEP = '\n\n';
  const budgetedSections: string[] = [];
  let used = 0;
  let omitted = 0;
  for (const section of sections) {
    const cost = section.length + SEP.length;
    if (used + cost <= CONTEXT_CHAR_BUDGET || budgetedSections.length === 0) {
      budgetedSections.push(section);
      used += cost;
    } else {
      omitted++;
    }
  }
  if (omitted > 0) {
    budgetedSections.push(
      `_(${omitted} lower-priority context section(s) omitted to stay within limits. Ask about a specific area for more detail.)_`
    );
  }

  return `# User Context for Personalized Advice

${budgetedSections.join(SEP)}

---
**Instructions for using this context**:
- Reference the user's profile, goals, skills, and entities when relevant
- If they ask about their products/services/projects, you have the details above
- Tailor your advice to their situation, background, and stated goals
- Help them leverage what they already have on OrangeCat
- Suggest ways to improve or expand their OrangeCat presence`;
}
