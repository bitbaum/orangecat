import { entityHandlers } from './entities';
import { communicationHandlers } from './communication';
import { organizationHandlers } from './organization';
import { contextHandlers } from './context';
import { productivityHandlers } from './productivity';
import { paymentHandlers } from './payments';
import { governanceHandlers } from './governance';
import { socialHandlers } from './social';
import { interestHandlers } from './interests';
import { siteBuildHandlers } from './site-build';
import type { ActionHandler } from './types';

export const ACTION_HANDLERS: Partial<Record<string, ActionHandler>> = {
  ...socialHandlers,
  ...interestHandlers,
  ...entityHandlers,
  ...communicationHandlers,
  ...organizationHandlers,
  ...contextHandlers,
  ...productivityHandlers,
  ...paymentHandlers,
  ...governanceHandlers,
  ...siteBuildHandlers,
};

export type { ActionHandler };
export { parseReminderDate } from './date-utils';
