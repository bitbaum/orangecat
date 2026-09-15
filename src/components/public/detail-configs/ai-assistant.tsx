import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { CompanionActions } from '@/components/companions/CompanionActions';
import { AssistantPriceChip } from '@/components/ai-assistants/AssistantPriceChip';
import type { EntityDetailConfig } from '@/components/public/PublicEntityDetailPage';
import { ROUTES } from '@/config/routes';

// ai_assistants price by pricing_model, stored in BTC (no currency column;
// the sats→BTC migration dropped the _sats suffix and converted values).
const AI_PRICE_BY_MODEL: Record<string, { column: string; suffix: string }> = {
  per_message: { column: 'price_per_message', suffix: ' / message' },
  per_token: { column: 'price_per_1k_tokens', suffix: ' / 1k tokens' },
  subscription: { column: 'subscription_price', suffix: ' / month' },
};

const getAiPricing = (entity: Record<string, unknown>) => {
  const model = (entity.pricing_model as string) || 'free';
  if (model === 'free') {
    return { isFree: true, amount: 0, suffix: '' };
  }
  const spec = AI_PRICE_BY_MODEL[model];
  const amount = spec ? Number(entity[spec.column] ?? 0) : 0;
  // A paid pricing model with no price set behaves as free — chip and chat
  // must agree, so normalize here (the chat charge path treats 0 as free too).
  if (amount <= 0) {
    return { isFree: true, amount: 0, suffix: '' };
  }
  return { isFree: false, amount, suffix: spec?.suffix ?? '' };
};

/**
 * SSOT for a companion's profile — shared by the public + owner dashboard
 * routes. The conversation is its own page (/companions/[id]/talk); this
 * page is who they are and what you can do: Talk, Clone, and Edit for the
 * owner. Private companions pass the visibility filter only for their owner
 * (PublicEntityDetailPage's owner preview).
 */
export const aiAssistantDetailConfig: EntityDetailConfig = {
  entityType: 'ai_assistant',
  ownerLabel: 'Made by',
  descriptionTitle: 'About',
  metadataSelect: 'title, description, avatar_url',
  // A private companion is the owner's alone. RLS already hides it from
  // strangers; this keeps the page honest even for a signed-in non-owner.
  visibilityFilter: { column: 'is_public', value: true },
  // No pay-the-seller-direct section: you don't pay an assistant up front — you
  // chat, and it charges per its pricing model (free / per-message via Cat
  // Credits) inside the chat widget. This also suppresses the default mobile
  // sticky CTA, which would otherwise anchor "Chat" to a #pay section that
  // shouldn't exist here. The chat widget is the primary action.
  showPaymentSection: false,
  getViewRoute: id => ROUTES.AI_ASSISTANTS.VIEW(id),
  renderHeaderIcon: entity =>
    entity.avatar_url ? (
      <Image
        src={entity.avatar_url as string}
        alt={(entity.title as string) || 'Companion'}
        width={64}
        height={64}
        className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
        unoptimized
      />
    ) : undefined,
  renderHeaderExtra: entity => {
    const pricing = getAiPricing(entity);
    const freePerDay = Number(entity.free_messages_per_day ?? 0);
    // Only shown when the assistant actually charges. On a free assistant every
    // message costs nothing regardless of this number, so "50 free per day"
    // would advertise a cap that does not exist — and `isFree` here is exactly
    // "computeCreatorChargeBtc returns 0", the same condition the charge path
    // uses, so the badge cannot disagree with the bill.
    const showFreeAllowance = !pricing.isFree && Number.isFinite(freePerDay) && freePerDay > 0;
    return (
      <div className="flex flex-wrap items-center gap-2">
        <AssistantPriceChip
          isFree={pricing.isFree}
          amountBtc={pricing.amount}
          suffix={pricing.suffix}
        />
        {showFreeAllowance && <Badge variant="secondary">First {freePerDay} free each day</Badge>}
      </div>
    );
  },
  renderDetails: (entity, _payable, isOwner, isSignedIn) => {
    const tags: string[] = Array.isArray(entity.tags) ? entity.tags : [];
    const traits: string[] = Array.isArray(entity.personality_traits)
      ? entity.personality_traits
      : [];

    return (
      <>
        <CompanionActions
          id={entity.id as string}
          isOwner={isOwner}
          isSignedIn={isSignedIn}
          isPublic={entity.is_public === true}
          conversations={Number(entity.total_conversations ?? 0)}
          clonedFrom={entity.cloned_from as string | null | undefined}
        />

        {(tags.length > 0 || traits.length > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            {tags.map(tag => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
            {traits.map(trait => (
              <Badge key={trait} variant="outline">
                {trait}
              </Badge>
            ))}
          </div>
        )}
      </>
    );
  },
};
