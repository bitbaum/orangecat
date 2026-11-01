/**
 * Companion routines cron route.
 *
 * Schedule: systemd timer `orangecat-cron@companion-routines.timer` on
 * bitbaum, every 15 minutes. Runs every routine whose time has come, as its
 * owner, on the owner's own key (services/companions/routines.ts); a person
 * without a key of their own gets a skipped run with the reason, never a
 * turn on the free chain.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { runDueRoutines } from '@/services/companions/routines';
import { CRON } from '@/constants/cron';
import { logger } from '@/utils/logger';
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/standardResponse';
import { verifyCronSecret } from '@/lib/api/cronAuth';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return apiUnauthorized();
  }
  try {
    const admin = createAdminClient();
    const result = await runDueRoutines(admin, CRON.BATCH_SIZE);
    logger.warn('companion routines run', { ...result }, 'CronCompanionRoutines');
    return apiSuccess(result);
  } catch (error) {
    logger.error('companion routines crashed', { error }, 'CronCompanionRoutines');
    return apiError('Companion routines run failed', 'INTERNAL_ERROR', 500);
  }
}
