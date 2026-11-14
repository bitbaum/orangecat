import { DATABASE_TABLES } from '@/config/database-tables';
import { completeTask, createTask, setReminder, updateTask } from '@/services/planner/tasks';
import type { ActionHandler } from './types';
import { createSocialWatch } from './social-watch-create';
import { SOCIAL_WATCH_KINDS, isSocialWatchKind } from '../social-watches';

const CONDITION_WATCH_KINDS = ['funding_reached', 'sale_received', 'booking_received'] as const;
const WATCH_KINDS = [...CONDITION_WATCH_KINDS, ...SOCIAL_WATCH_KINDS] as const;
type WatchKind = (typeof WATCH_KINDS)[number];

export const productivityHandlers: Record<string, ActionHandler> = {
  // A watch is a reminder with a CONDITION instead of a date. Rows are
  // evaluated by the cat-watches cron; firing delivers a notification.
  create_watch: async (supabase, userId, _actorId, params) => {
    const kind = params.kind as WatchKind;
    if (!WATCH_KINDS.includes(kind)) {
      return {
        success: false,
        error: `Unknown watch kind "${String(params.kind)}". Use one of: ${WATCH_KINDS.join(', ')}.`,
      };
    }
    const label = typeof params.label === 'string' ? params.label.trim().slice(0, 200) : '';
    if (!label) {
      return {
        success: false,
        error: 'Pass "label" — what to tell the user when the watch fires.',
      };
    }
    if (isSocialWatchKind(kind)) {
      return createSocialWatch(supabase, userId, kind, label, params);
    }
    const targetBtc = typeof params.target_btc === 'number' ? params.target_btc : null;
    const entityId = typeof params.entity_id === 'string' ? params.entity_id : null;
    if (kind === 'funding_reached' && (!entityId || !targetBtc || targetBtc <= 0)) {
      return {
        success: false,
        error:
          'funding_reached needs entity_id (the entity being funded, from context) and target_btc > 0.',
      };
    }

    const { data, error } = await supabase
      .from(DATABASE_TABLES.CAT_WATCHES)
      .insert({
        user_id: userId,
        kind,
        label,
        entity_type: typeof params.entity_type === 'string' ? params.entity_type : null,
        entity_id: entityId,
        target_btc: targetBtc,
      })
      .select()
      .single();
    if (error) {
      return { success: false, error: error.message };
    }
    const cadence =
      kind === 'funding_reached'
        ? ` (fires when funding reaches ${targetBtc} BTC; checked every 15 min)`
        : ' (checked every 15 min)';
    return {
      success: true,
      data: { ...data, displayMessage: `👁️ Watching: "${label}"${cadence}` },
    };
  },

  cancel_watch: async (supabase, userId, _actorId, params) => {
    const watchId = typeof params.watch_id === 'string' ? params.watch_id : null;
    if (!watchId) {
      // Without an id, cancel only when it's unambiguous; otherwise list them.
      const { data } = await supabase
        .from(DATABASE_TABLES.CAT_WATCHES)
        .select('id, label')
        .eq('user_id', userId)
        .eq('status', 'active');
      const active = (data ?? []) as Array<{ id: string; label: string }>;
      if (active.length === 0) {
        return { success: false, error: 'No active watches to cancel.' };
      }
      if (active.length > 1) {
        return {
          success: false,
          error: `Several active watches: ${active
            .map(w => `"${w.label}" (watch_id: ${w.id})`)
            .join(', ')}. Ask which one, then call cancel_watch with that watch_id.`,
        };
      }
      const { error } = await supabase
        .from(DATABASE_TABLES.CAT_WATCHES)
        .update({ status: 'cancelled' })
        .eq('user_id', userId)
        .eq('id', active[0].id);
      if (error) {
        return { success: false, error: error.message };
      }
      return {
        success: true,
        data: { displayMessage: `🚫 Stopped watching: "${active[0].label}"` },
      };
    }

    const { data, error } = await supabase
      .from(DATABASE_TABLES.CAT_WATCHES)
      .update({ status: 'cancelled' })
      .eq('user_id', userId)
      .eq('id', watchId)
      .eq('status', 'active')
      .select('label')
      .single();
    if (error || !data) {
      return { success: false, error: 'No active watch with that id — nothing was cancelled.' };
    }
    return {
      success: true,
      data: { displayMessage: `🚫 Stopped watching: "${(data as { label: string }).label}"` },
    };
  },

  // The person's own list. The bodies are services/planner/tasks.ts, shared
  // with a bot's own work loop.
  create_task: (supabase, userId, _actorId, params) => createTask(supabase, userId, params),
  set_reminder: (supabase, userId, _actorId, params) => setReminder(supabase, userId, params),
  complete_task: (supabase, userId, _actorId, params) => completeTask(supabase, userId, params),
  update_task: (supabase, userId, _actorId, params) => updateTask(supabase, userId, params),
};
