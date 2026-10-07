import { WalletSelectorField } from '@/components/create/wallet-selector/WalletSelectorField';
import type { FieldGroup } from '@/components/create/types';
import { PAY_DESTINATION_COPY } from '@/config/pay-destination';

/**
 * The "Pay into" group — one definition for every entity that receives money.
 * Seven configs carried their own copy (two ids, two shapes) and drifted.
 *
 * `addressColumns` is for tables that still carry bitcoin_address /
 * lightning_address. Declaring them as the group's fields matters there: the
 * picker renders as a custom component and ignores them, but a wizard places
 * a group on the step that lists its fields — and shows a group with no
 * fields on EVERY step. Tables without the columns must not declare them
 * (the form↔schema drift audit holds that line).
 */
export function walletFieldGroup({
  description = 'Where money for this page should land',
  addressColumns = false,
}: { description?: string; addressColumns?: boolean } = {}): FieldGroup {
  return {
    id: 'payment',
    title: PAY_DESTINATION_COPY.payInto,
    description,
    customComponent: WalletSelectorField,
    ...(addressColumns && {
      fields: [
        { name: 'bitcoin_address', label: 'Bitcoin Address', type: 'bitcoin_address' },
        { name: 'lightning_address', label: 'Lightning Address', type: 'text' },
      ],
    }),
  };
}

/** For entities whose table has no address columns (the wallet link is all). */
export const WALLET_FIELD_GROUP: FieldGroup = walletFieldGroup();
