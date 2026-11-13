/**
 * A bot's own browser, driven one step at a time, as the person.
 *
 * Cat Bot's computer use (docs/PARITY.md, plan step 2). The browser is
 * Loki's, one per bot, never this web process; the rail is the signed one.
 * Every step is answered with what the page now shows: its address, what
 * can be read, what can be clicked or typed into (numbered), and a picture
 * the thread shows. A bot never types a password or a card: Loki stops that
 * step and says the owner does it.
 */
import { ECOSYSTEM, LOKI_ENDPOINTS } from '@/config/ecosystem';
import { logger } from '@/utils/logger';
import { postSignedToLoki } from './signed-post';

export const BROWSER_STEPS = [
  'open',
  'click',
  'type',
  'press',
  'scroll',
  'back',
  'look',
  'close',
] as const;
export type BrowserStepKind = (typeof BROWSER_STEPS)[number];

const BROWSER_TIMEOUT_MS = 75_000;
/** What the thread and the model are shown of a page: enough to act on. */
const TEXT_SHOWN = 700;
const ELEMENTS_SHOWN = 30;

export interface BrowserView {
  url: string;
  title: string;
  text: string;
  elements: Array<{ n: number; kind: string; name: string }>;
  screenshotUrl?: string;
}

export type BrowserOutcome =
  | { ok: true; done: true; closed: boolean; view?: BrowserView }
  | { ok: true; done: false; stopped: boolean; detail: string; view?: BrowserView }
  | { ok: false; reason: string };

export function lokiBrowserUrl(): string {
  return (
    process.env.LOKI_BROWSER_URL ||
    new URL(LOKI_ENDPOINTS.browser, ECOSYSTEM.loki.siteUrl).toString()
  );
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const int = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 500 ? n : null;
};

/**
 * The step Loki is asked for, from what a bot wrote, or the sentence that
 * says what is missing. Nothing is sent for a step that cannot be one.
 */
export function browserAction(
  params: Record<string, unknown>
): { ok: true; action: Record<string, unknown> } | { ok: false; error: string } {
  const kind = str(params.do).toLowerCase() as BrowserStepKind;
  if (!BROWSER_STEPS.includes(kind)) {
    return { ok: false, error: `"do" is one of: ${BROWSER_STEPS.join(', ')}.` };
  }
  const n = int(params.n);
  switch (kind) {
    case 'open': {
      const url = str(params.url);
      if (!/^https?:\/\/\S+$/i.test(url)) {
        return { ok: false, error: 'To open a page, give its full address (https://…) as "url".' };
      }
      return { ok: true, action: { do: 'open', url } };
    }
    case 'click': {
      const label = str(params.label);
      if (!n && !label) {
        return {
          ok: false,
          error:
            'To click, give the element\'s number from the last result as "n", or its words as "label".',
        };
      }
      return { ok: true, action: { do: 'click', ...(n ? { n } : { label: label.slice(0, 200) }) } };
    }
    case 'type': {
      const text = typeof params.text === 'string' ? params.text : '';
      if (!text) {
        return { ok: false, error: 'To type, give the words as "text" and the field as "n".' };
      }
      const submit = params.submit === true || params.submit === 'true';
      return {
        ok: true,
        action: {
          do: 'type',
          text: text.slice(0, 2000),
          ...(n ? { n } : {}),
          ...(submit ? { submit } : {}),
        },
      };
    }
    case 'press': {
      const key = str(params.key);
      const known = [
        'Enter',
        'Tab',
        'Escape',
        'Backspace',
        'ArrowDown',
        'ArrowUp',
        'PageDown',
        'PageUp',
      ].find(k => k.toLowerCase() === key.toLowerCase());
      if (!known) {
        return {
          ok: false,
          error:
            '"key" is one of: Enter, Tab, Escape, Backspace, ArrowDown, ArrowUp, PageDown, PageUp.',
        };
      }
      return { ok: true, action: { do: 'press', key: known } };
    }
    case 'scroll':
      return { ok: true, action: { do: 'scroll', by: str(params.by) === 'up' ? 'up' : 'down' } };
    default:
      return { ok: true, action: { do: kind } };
  }
}

function safeJson(body: string | undefined): Record<string, unknown> | null {
  if (!body) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(body);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function readView(raw: unknown): BrowserView | undefined {
  const rec = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  if (!rec || typeof rec.url !== 'string') {
    return undefined;
  }
  const elements = (Array.isArray(rec.elements) ? rec.elements : [])
    .map(e => (e && typeof e === 'object' ? (e as Record<string, unknown>) : {}))
    .filter(e => typeof e.n === 'number')
    .map(e => ({ n: e.n as number, kind: str(e.kind), name: str(e.name) }));
  const shot = str(rec.screenshotUrl);
  return {
    url: rec.url,
    title: str(rec.title),
    text: typeof rec.text === 'string' ? rec.text : '',
    elements,
    ...(/^https:\/\//.test(shot) ? { screenshotUrl: shot } : {}),
  };
}

export async function browserStepWithLoki(input: {
  actorId: string;
  botId: string;
  action: Record<string, unknown>;
}): Promise<BrowserOutcome> {
  const result = await postSignedToLoki(
    lokiBrowserUrl(),
    {
      actorId: input.actorId,
      issuedAt: new Date().toISOString(),
      botId: input.botId,
      action: input.action,
    },
    { timeoutMs: BROWSER_TIMEOUT_MS }
  );
  const parsed = safeJson(result.body);
  if (!result.ok) {
    logger.warn('[loki-browser] refused', { actorId: input.actorId, status: result.status });
    const detail = str(parsed?.detail);
    return { ok: false, reason: `The browser did not take that step: ${detail || result.error}` };
  }
  if (!parsed || typeof parsed.done !== 'boolean') {
    return {
      ok: false,
      reason:
        "Loki answered, but what the browser did could not be read. Say so, and don't invent a page.",
    };
  }
  const view = readView(parsed.view);
  if (parsed.done) {
    return { ok: true, done: true, closed: parsed.closed === true, ...(view ? { view } : {}) };
  }
  return {
    ok: true,
    done: false,
    stopped: parsed.reason === 'stopped',
    detail: str(parsed.detail) || 'That step did not work.',
    ...(view ? { view } : {}),
  };
}

/** The page as lines: the picture, where it is, what it says, what can be used. */
export function viewLines(view: BrowserView): string[] {
  const lines: string[] = [];
  if (view.screenshotUrl) {
    lines.push(`![The page](${view.screenshotUrl})`);
  }
  lines.push(`Now on: ${view.title ? `“${view.title}” ` : ''}${view.url}`);
  const text = view.text.replace(/\s*\n\s*/g, ' · ').trim();
  if (text) {
    lines.push(`It says: ${text.length > TEXT_SHOWN ? `${text.slice(0, TEXT_SHOWN)}…` : text}`);
  }
  if (view.elements.length) {
    const shown = view.elements
      .slice(0, ELEMENTS_SHOWN)
      .map(e => `${e.n} ${e.kind}${e.name ? ` “${e.name}”` : ''}`);
    lines.push(
      `Can be used (number, kind, words): ${shown.join('; ')}${view.elements.length > ELEMENTS_SHOWN ? '; …' : ''}`
    );
  }
  return lines;
}

/** The lines the thread keeps for one step. */
export function browserMessage(o: Extract<BrowserOutcome, { ok: true }>): string {
  if (o.done && o.closed) {
    return 'The browser is closed.';
  }
  const head = o.done ? null : o.detail;
  const view = o.view ? viewLines(o.view) : [];
  return [head, ...view].filter(Boolean).join('\n\n') || 'Done.';
}
