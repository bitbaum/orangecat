import { WalletSelectorField } from '@/components/create/wallet-selector/WalletSelectorField';
import type { FieldGroup } from '@/components/create/types';

export const WALLET_FIELD_GROUP: FieldGroup = {
  id: 'payment',
  title: 'Pay into',
  description: 'Where money for this page should land',
  customComponent: WalletSelectorField,
};
