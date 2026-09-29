/**
 * A research milestone as a Solon proposal: a fileable category, and the
 * evidence a voter needs cited in the body.
 */
import { researchMilestoneProposal } from '@/domain/research/governance';
import { SOLON_PROPOSAL_CATEGORY } from '@/config/solon';

const PAGE = 'https://orangecat.ch/research/abc';

it('cites the milestone, the pre-registration and every output', () => {
  const draft = researchMilestoneProposal(
    {
      title: 'Soil carbon',
      current_milestone: 'Season one analysed',
      output_links: ['https://zenodo.org/records/1', 'ipfs://bafy'],
      preregistration_sha256: 'b'.repeat(64),
      preregistered_at: '2026-09-01T00:00:00Z',
    },
    PAGE
  );
  expect(draft.category).toBe(SOLON_PROPOSAL_CATEGORY.TREASURY_SPEND);
  expect(draft.title).toContain('Season one analysed');
  for (const needle of [PAGE, 'b'.repeat(64), 'https://zenodo.org/records/1', 'ipfs://bafy']) {
    expect(draft.body).toContain(needle);
  }
});

it('says plainly when there is nothing to judge yet', () => {
  const draft = researchMilestoneProposal({ title: 'Soil carbon' }, PAGE);
  expect(draft.title).toContain('Soil carbon');
  expect(draft.body).toContain('no outputs are published yet');
  expect(draft.body).toContain('(describe what was delivered)');
});
