/**
 * Lookup tool handlers — the READ side of Cat's tool surface: explore a topic
 * (discovery), read the user's own data, and read Cat's own track record. None
 * of them mutates anything.
 *
 * Split from tool-executor.ts (500-line service limit) along the natural seam:
 * lookups here; generative/mutating tools (prefill, website analysis, offers,
 * forgetting) stay in the executor, which dispatches to these.
 */

import { isValidEntityType, type EntityType } from '@/config/entity-registry';
import { MY_DATA_TOPICS, type MyDataTopic } from './my-data-topics';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import type {
  ToolResultMessage,
  ToolCallResultRef,
  OnToolCall,
  RawToolCall,
} from './tool-use-types';

export async function handleExploreTopic(
  supabase: AnySupabaseClient,
  userId: string,
  toolCall: RawToolCall,
  onToolCall?: OnToolCall
): Promise<ToolResultMessage> {
  const toolName = 'explore_topic';
  // ── explore_topic ────────────────────────────────────────────────────────
  // Interest-driven discovery: semantic match across every indexed type, then
  // the PEOPLE behind the hits (resolved from ownership, because almost no
  // profile carries a bio). Read-only; the introduction is a separate,
  // confirmed action.

    const parsedArgs = (() => {
      try {
        return JSON.parse(toolCall.function.arguments ?? '{}') as {
          topic?: string;
          entityType?: string;
        };
      } catch {
        return {} as { topic?: string; entityType?: string };
      }
    })();
    const topic = (parsedArgs.topic ?? '').trim();
    if (!topic) {
      onToolCall?.({ id: toolCall.id, name: toolName, status: 'failed', error: 'no_topic' });
      return {
        role: 'tool',
        tool_call_id: toolCall.id,
        content: 'No topic was provided. Ask the user what subject they want to explore.',
      };
    }

    onToolCall?.({ id: toolCall.id, name: toolName, status: 'running', args: { query: topic } });
    try {
      const { exploreTopic, formatDiscoveryForModel } = await import('./discovery');
      const result = await exploreTopic(supabase, userId, topic, {
        entityType:
          parsedArgs.entityType && isValidEntityType(parsedArgs.entityType)
            ? (parsedArgs.entityType as EntityType)
            : undefined,
      });

      const refs: ToolCallResultRef[] = [
        ...result.hits.map(h => ({ url: h.url, type: h.entityType as string, title: h.title })),
        ...result.people
          .filter(p => p.profileUrl)
          .map(p => ({ url: p.profileUrl!, type: 'person', title: p.displayName })),
      ].slice(0, 10);

      if (refs.length > 0) {
        onToolCall?.({
          id: toolCall.id,
          name: toolName,
          status: 'completed',
          resultCount: refs.length,
          results: refs,
        });
      } else {
        onToolCall?.({ id: toolCall.id, name: toolName, status: 'no_results' });
      }

      return {
        role: 'tool',
        tool_call_id: toolCall.id,
        content: formatDiscoveryForModel(result),
      };
    } catch (err) {
      onToolCall?.({
        id: toolCall.id,
        name: toolName,
        status: 'failed',
        error: err instanceof Error ? err.message : 'unknown',
      });
      return {
        role: 'tool',
        tool_call_id: toolCall.id,
        content:
          'Exploring that topic failed. Tell the user honestly that the search did not run — do NOT say the platform has nothing on it.',
      };
    }
}

export async function handleQueryMyData(
  supabase: AnySupabaseClient,
  userId: string,
  toolCall: RawToolCall,
  onToolCall?: OnToolCall
): Promise<ToolResultMessage> {
  const toolName = 'query_my_data';
  // ── query_my_data ────────────────────────────────────────────────────────
  // Read-only mirror of the user's own platform state (listings, earnings,
  // bookings, wallets, notifications, tasks). No permission gate — it mutates
  // nothing — and it returns prose, not JSON, so weak models paraphrase
  // instead of echoing raw structures.

    const parsedArgs = (() => {
      try {
        return JSON.parse(toolCall.function.arguments ?? '{}') as {
          topic?: string;
          days?: number;
        };
      } catch {
        return {} as { topic?: string; days?: number };
      }
    })();
    const topic = (
      MY_DATA_TOPICS.includes(parsedArgs.topic as MyDataTopic) ? parsedArgs.topic : 'overview'
    ) as MyDataTopic;

    onToolCall?.({ id: toolCall.id, name: toolName, status: 'running', args: { topic } });
    try {
      const { queryMyData } = await import('./my-data');
      const report = await queryMyData(supabase, userId, topic, { days: parsedArgs.days });
      onToolCall?.({
        id: toolCall.id,
        name: toolName,
        status: 'completed',
        resultCount: 1,
        results: [],
      });
      return {
        role: 'tool',
        tool_call_id: toolCall.id,
        content: `LIVE DATA (the user's own, just read):\n${report}\n\nAnswer the user's question from THIS data only. Amounts are BTC; present them in the user's display currency style when natural. If a section says it could not be read, say so honestly for that part — never fill gaps with guesses.`,
      };
    } catch (err) {
      onToolCall?.({
        id: toolCall.id,
        name: toolName,
        status: 'failed',
        error: err instanceof Error ? err.message : 'unknown',
      });
      return {
        role: 'tool',
        tool_call_id: toolCall.id,
        content:
          'Reading the data failed — tell the user honestly that you could not read their live data right now, and that their dashboard shows the authoritative numbers.',
      };
    }
}

export async function handleCheckMyTrackRecord(
  supabase: AnySupabaseClient,
  userId: string,
  toolCall: RawToolCall,
  onToolCall?: OnToolCall
): Promise<ToolResultMessage> {
  const toolName = 'check_my_track_record';
  // ── check_my_track_record ────────────────────────────────────────────────
  // ADR-0006 D6: Cat can check its OWN work. The same derivation that feeds
  // the ambient "Track Record" context section, but on demand — so "what did
  // you do for me?" is answered from the action log and entity tables, and
  // Cat can notice its own pattern (drafted, never published) before
  // proposing more of the same. Read-only; no permission gate; no arguments.
  onToolCall?.({ id: toolCall.id, name: toolName, status: 'running' });
  try {
    const { getCatTrackRecord, formatTrackRecordForModel } = await import('./track-record');
    const record = await getCatTrackRecord(supabase, userId);
    const proposed = record?.proposed ?? 0;
    onToolCall?.({
      id: toolCall.id,
      name: toolName,
      status: 'completed',
      resultCount: proposed,
      results: [],
    });
    return {
      role: 'tool',
      tool_call_id: toolCall.id,
      content: formatTrackRecordForModel(record),
    };
  } catch (err) {
    onToolCall?.({
      id: toolCall.id,
      name: toolName,
      status: 'failed',
      error: err instanceof Error ? err.message : 'unknown',
    });
    return {
      role: 'tool',
      tool_call_id: toolCall.id,
      content:
        'Reading your own track record failed — tell the user honestly that you cannot see your history right now, and do not reconstruct it from memory.',
    };
  }
}
