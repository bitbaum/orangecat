import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import FundingProgress from '@/components/public/FundingProgress';
import EntityLedgerTotal from '@/components/public/EntityLedgerTotal';
import ResearchOpenScience from '@/components/public/ResearchOpenScience';
import ResearchReviews from '@/components/public/ResearchReviews';
import { researchMilestoneProposal } from '@/domain/research/governance';
import type { EntityDetailConfig } from '@/components/public/PublicEntityDetailPage';
import { ROUTES } from '@/config/routes';
import { SITE_URL } from '@/config/brand';
import { RESEARCH_FIELDS, METHODOLOGIES, TIMELINES } from '@/config/research';

const FIELD_LABELS = Object.fromEntries(RESEARCH_FIELDS.map(f => [f.value, f.label]));
const METHODOLOGY_LABELS = Object.fromEntries(METHODOLOGIES.map(m => [m.value, m.label]));
const TIMELINE_LABELS = Object.fromEntries(TIMELINES.map(t => [t.value, t.label]));

/** SSOT for the research detail page — shared by the public + owner dashboard routes. */
export const researchDetailConfig: EntityDetailConfig = {
  entityType: 'research',
  ownerLabel: 'Lead Researcher',
  descriptionTitle: 'About this Research',
  metadataSelect: 'title, description',
  getViewRoute: id => ROUTES.RESEARCH.VIEW(id),
  getSolonDraft: (entity, pageUrl) =>
    researchMilestoneProposal(
      {
        title: String(entity.title ?? ''),
        current_milestone: entity.current_milestone,
        output_links: entity.output_links,
        preregistration_sha256: entity.preregistration_sha256,
        preregistered_at: entity.preregistered_at,
      },
      pageUrl
    ),
  renderHeaderExtra: entity => {
    if (!entity.field) {
      return null;
    }
    return (
      <Badge variant="outline" className="capitalize">
        {FIELD_LABELS[entity.field] || entity.field}
      </Badge>
    );
  },
  renderDetails: (entity, _hasReceive, isOwner, signedIn) => {
    const fundingGoal = Number(entity.funding_goal_btc ?? entity.funding_goal ?? 0);
    const fundingRaised = Number(entity.funding_raised_btc ?? 0);

    return (
      <>
        <FundingProgress raised={fundingRaised} goal={fundingGoal} currency="BTC" />
        {/* Honest, ledger-derived BTC total — renders only when the owner has
            opted the fundraise into transparency (public/total). */}
        <EntityLedgerTotal entityType="research" entityId={String(entity.id)} />

        {/* Research Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Research Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {entity.methodology && (
              <div className="flex justify-between text-sm">
                <span className="text-fg-secondary">Methodology</span>
                <span className="font-medium">
                  {METHODOLOGY_LABELS[entity.methodology] || entity.methodology}
                </span>
              </div>
            )}
            {entity.timeline && (
              <div className="flex justify-between text-sm">
                <span className="text-fg-secondary">Timeline</span>
                <span className="font-medium">
                  {TIMELINE_LABELS[entity.timeline] || entity.timeline}
                </span>
              </div>
            )}
            {entity.current_milestone && (
              <div className="flex justify-between gap-3 text-sm">
                <span className="shrink-0 text-fg-secondary">Current milestone</span>
                <span className="text-right font-medium">{entity.current_milestone}</span>
              </div>
            )}
            {entity.lead_researcher && (
              <div className="flex justify-between text-sm">
                <span className="text-fg-secondary">Lead Researcher</span>
                <span className="font-medium">{entity.lead_researcher}</span>
              </div>
            )}
            {entity.expected_outcome && (
              <div className="pt-2 border-t border-subtle">
                <p className="text-sm text-fg-secondary mb-1">Expected Outcome</p>
                <p className="text-sm text-fg-primary">{entity.expected_outcome}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <ResearchOpenScience
          researchId={String(entity.id)}
          nostrPubkey={entity.nostr_pubkey}
          nostrPublishedAt={entity.nostr_published_at}
          publish={
            isOwner
              ? {
                  research: {
                    id: String(entity.id),
                    title: String(entity.title ?? ''),
                    description: String(entity.description ?? ''),
                    field: entity.field,
                    license: entity.license,
                    output_links: entity.output_links,
                    preregistration: entity.preregistration,
                    preregistration_sha256: entity.preregistration_sha256,
                    preregistered_at: entity.preregistered_at,
                  },
                  pageUrl: `${SITE_URL}${ROUTES.RESEARCH.VIEW(String(entity.id))}`,
                }
              : undefined
          }
          license={entity.license}
          outputLinks={entity.output_links}
          preregistration={entity.preregistration}
          preregistrationSha256={entity.preregistration_sha256}
          preregisteredAt={entity.preregistered_at}
        />

        <ResearchReviews
          researchId={String(entity.id)}
          outputLinks={(entity.output_links as string[] | null) ?? []}
          canReview={Boolean(signedIn && !isOwner && entity.is_public)}
          signedIn={Boolean(signedIn)}
        />
      </>
    );
  },
};
