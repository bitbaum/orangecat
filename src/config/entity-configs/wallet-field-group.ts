import { WalletSelectorField } from '@/components/create/wallet-selector/WalletSelectorField';
import type { FieldGroup } from '@/components/create/types';
import { PAY_DESTINATION_COPY } from '@/config/pay-destination';

export const WALLET_FIELD_GROUP: FieldGroup = {
  id: 'payment',
  title: PAY_DESTINATION_COPY.payInto,
  description: 'Where money for this page should land',
  customComponent: WalletSelectorField,
};
