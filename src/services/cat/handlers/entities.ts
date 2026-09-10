/**
 * Entity action handlers.
 *
 * Kept as one map for the handler registry, but split across two modules so
 * neither exceeds the service size limit: creation (entities-create.ts) and
 * management — update / publish / archive (entities-manage.ts), and setting
 * things up for someone who is not here (for-someone.ts).
 */

import { entityCreateHandlers } from './entities-create';
import { entityManageHandlers } from './entities-manage';
import { forSomeoneHandlers } from './for-someone';
import type { ActionHandler } from './types';

export const entityHandlers: Record<string, ActionHandler> = {
  ...entityCreateHandlers,
  ...entityManageHandlers,
  ...forSomeoneHandlers,
};
