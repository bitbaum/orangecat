import FundingProgress from '@/components/public/FundingProgress';
import EntityLedgerTotal from '@/components/public/EntityLedgerTotal';
import EntityOpenLedger from '@/components/public/EntityOpenLedger';
import type { EntityDetailConfig } from '@/components/public/PublicEntityDetailPage';
import { ROUTES } from '@/config/routes';

// user_causes stores goal_amount in its chosen `currency` (causes can be BTC OR CHF),
// and the raised total is column `total_raised` — NOT `raised_amount`. Read
// total_raised + currency, format with formatCurrency. See decision_currency_convention.
const causeFunding = (entity: Record<string, unknown>) => ({
  goal: Number(entity.goal_amount ?? 0),
  raised: Number(entity.total_raised ?? 0),
  currency: (entity.currency as string) || 'BTC',
});

/** SSOT for the cause detail page — shared by the public + owner dashboard routes. */
export const causeDetailConfig: EntityDetailConfig = {
  entityType: 'cause',
  ownerLabel: 'Organized By',
  descriptionTitle: 'About this Cause',
  metadataSelect: 'title, description',
  getViewRoute: id => ROUTES.CAUSES.VIEW(id),
  getJsonLdExtra: entity => {
    const { goal, currency } = causeFunding(entity);
    return goal > 0
      ? {
          funding: {
            '@type': 'MonetaryGrant',
            amount: { '@type': 'MonetaryAmount', value: goal, currency },
          },
        }
      : {};
  },
  renderDetails: entity => {
    const { goal, raised, currency } = causeFunding(entity);
    // Always render — a cause with no goal set must still show an inviting
    // funding state, never a blank page. FundingProgress owns that decision.
    // EntityLedgerTotal adds the honest, ledger-derived BTC total when the
    // owner has made the fundraise public; it renders nothing when private.
    return (
      <div className="space-y-4">
        <FundingProgress raised={raised} goal={goal} currency={currency} />
        <EntityLedgerTotal entityType="cause" entityId={String(entity.id)} />
        <EntityOpenLedger entityType="cause" entityId={String(entity.id)} />
      </div>
    );
  },
};
