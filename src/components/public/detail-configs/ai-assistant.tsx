import { Badge } from '@/components/ui/badge';
import { CompanionActions } from '@/components/companions/CompanionActions';
import { AssistantPriceChip } from '@/components/ai-assistants/AssistantPriceChip';
import { Face } from '@/components/companions/talk/CompanionFace';
import type { EntityDetailConfig } from '@/components/public/PublicEntityDetailPage';
import { ownerOnlyStatus } from '@/components/public/public-entity-detail-config';
import { ROUTES } from '@/config/routes';
import { PUBLIC_VISIBILITY } from '@/config/public-visibility';

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
  visibilityFilter: PUBLIC_VISIBILITY.ai_assistant,
  // A companion is not bought: Talk is the action, and per-message pricing
  // (when set) is charged inside the chat. What a visitor CAN do besides is
  // support a public companion: the registry marks the type supportable, and
  // this card pays the wallet its owner chose under "Pay into", directly. Not
  // on a private companion, and not for a visitor when no wallet can be
  // reached (the owner still sees how to add one). No sticky bar: it would
  // anchor "Support" above Talk on a phone.
  showPaymentSection: false,
  paymentSectionFor: entity => entity.is_public === true,
  paymentNeedsWallet: true,
  supportTitle: entity => `Support ${(entity.title as string) || 'this companion'}`,
  mobileStickyCTA: null,
  statusBadge: ownerOnlyStatus,
  getViewRoute: id => ROUTES.AI_ASSISTANTS.VIEW(id),
  // Its face: the picture or face it was given, else the face its name picks
  // (the same one it wears in Talk), never a stock robot.
  renderHeaderIcon: entity => (
    <Face
      name={(entity.title as string) || ''}
      avatarUrl={(entity.avatar_url as string | null) ?? null}
      size={64}
      className="flex-shrink-0"
    />
  ),
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
