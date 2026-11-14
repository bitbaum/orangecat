import { entityHandlers } from './entities';
import { communicationHandlers } from './communication';
import { organizationHandlers } from './organization';
import { contextHandlers } from './context';
import { productivityHandlers } from './productivity';
import { paymentHandlers } from './payments';
import { walletLedgerHandlers } from './wallet-ledger';
import { governanceHandlers } from './governance';
import { socialHandlers } from './social';
import { interestHandlers } from './interests';
import { siteBuildHandlers } from './site-build';
import { lokiTaskHandlers } from './loki-task';
import { lokiAskHandlers } from './loki-ask';
import { connectorHandlers } from './connectors';
import { plannerHandlers } from './planner';
import { lokiSessionsHandlers } from './loki-sessions';
import { lokiFindingHandlers } from './loki-findings';
import { promotionHandlers } from './promotion';
import { civicSplitHandlers } from './civic-split';
import type { ActionHandler } from './types';
import { investorRoomHandlers } from './investor-room';

export const ACTION_HANDLERS: Partial<Record<string, ActionHandler>> = {
  ...investorRoomHandlers,
  ...socialHandlers,
  ...interestHandlers,
  ...entityHandlers,
  ...communicationHandlers,
  ...organizationHandlers,
  ...contextHandlers,
  ...productivityHandlers,
  ...paymentHandlers,
  ...walletLedgerHandlers,
  ...governanceHandlers,
  ...siteBuildHandlers,
  ...lokiTaskHandlers,
  ...lokiAskHandlers,
  ...lokiSessionsHandlers,
  ...connectorHandlers,
  ...plannerHandlers,
  ...lokiFindingHandlers,
  ...promotionHandlers,
  ...civicSplitHandlers,
};

export type { ActionHandler };
export { parseReminderDate } from './date-utils';
