/**
 * A research milestone as a Solon proposal — pure.
 *
 * Backers fund research; whether a milestone was actually met, and so whether
 * the next tranche goes out, is a decision, not the researcher's say-so. Solon
 * decides it with signed votes and holds no money. This builds the pre-filled
 * draft OrangeCat's "Govern it with Solon" link carries (Solon reads it in
 * lib/domain/proposal-draft). The draft cites the evidence a voter needs:
 * what was committed before results, and where the outputs are.
 */

import { SOLON_PROPOSAL_CATEGORY } from '@/config/solon';

export interface ResearchForProposal {
  title: string;
  current_milestone?: string | null;
  output_links?: string[] | null;
  preregistration_sha256?: string | null;
  preregistered_at?: string | null;
}

export interface SolonDraft {
  title: string;
  body: string;
  category: string;
}

export function researchMilestoneProposal(r: ResearchForProposal, pageUrl: string): SolonDraft {
  const milestone = r.current_milestone?.trim();
  const lines = [
    milestone
      ? `Milestone claimed: ${milestone}`
      : 'Milestone claimed: (describe what was delivered)',
    '',
    `Research: ${pageUrl}`,
  ];
  if (r.preregistration_sha256 && r.preregistered_at) {
    lines.push(
      `Pre-registered ${r.preregistered_at.slice(0, 10)} · SHA-256 ${r.preregistration_sha256}`
    );
  }
  const outputs = r.output_links ?? [];
  lines.push(
    '',
    outputs.length > 0 ? 'Evidence:' : 'Evidence: no outputs are published yet.',
    ...outputs.map(link => `- ${link}`),
    '',
    'Vote yes if the evidence shows the milestone was met and the next tranche should be released.'
  );
  return {
    title: `Release the next tranche: ${milestone || r.title}`,
    body: lines.join('\n'),
    category: SOLON_PROPOSAL_CATEGORY.TREASURY_SPEND,
  };
}
