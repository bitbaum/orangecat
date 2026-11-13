/**
 * A bot's hands as rows for its owner to switch: what each one does, in
 * words, and its setting. Pure; the route adds what the owner holds.
 */
import { CAT_ACTIONS, type ActionCategory } from '@/config/cat-actions';
import { COMPANION_HANDS, handsActions } from './hands';
import { canRunOnItsOwn, handMode, type HandGrants, type HandMode } from './hand-grants';

export interface HandRow {
  id: string;
  name: string;
  /** One sentence, the action's own. */
  description: string;
  mode: HandMode;
  /** It only reads: nothing is made, sent or changed. */
  readOnly: boolean;
  /** It starts work or files something outside OrangeCat. */
  acts: boolean;
  /** It can ever run on its own (hand-grants.ts, canRunOnItsOwn). */
  canAuto: boolean;
  /** The owner can switch it to "on its own" now (they hold, or a tap would grant, the permission). */
  available: boolean;
  /** The Cat permission it rides on, for the link when it is not available. */
  category: ActionCategory;
}

/** Hands that only read. Named, not guessed from a description. */
const READS: ReadonlySet<string> = new Set([
  'ask_loki',
  'project_status',
  'loki_sessions',
  'loki_run_status',
  'loki_finding_status',
  'walk_site',
  'github_read',
  'gmail_read',
  'calendar_read',
]);

export function handRows(grants: HandGrants, held?: ReadonlySet<string>): HandRow[] {
  return handsActions(COMPANION_HANDS).map(action => ({
    id: action.id,
    name: action.name,
    description: action.description,
    mode: handMode(grants, action.id),
    readOnly: READS.has(action.id),
    acts: action.riskLevel !== 'low' && !READS.has(action.id),
    canAuto: canRunOnItsOwn(action.id),
    available: canRunOnItsOwn(action.id) && (held ? held.has(action.id) : true),
    category: CAT_ACTIONS[action.id].category,
  }));
}
