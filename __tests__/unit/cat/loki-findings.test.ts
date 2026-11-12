/**
 * A bot files a finding into Loki's feedback inbox — what it may say.
 *
 * Filed is not fixed, a refusal is Loki's own sentence, and an unreadable
 * answer is never reported as a filing.
 */
import { lokiFindingHandlers } from '@/services/cat/handlers/loki-findings';
import { fileLokiFinding, LOKI_FINDING_MAX_LENGTH } from '@/services/loki/findings';
import type { AnySupabaseClient } from '@/lib/supabase/types';

const SECRET = 'x'.repeat(48);
const ACTOR = '00000000-0000-4000-8000-000000000000';
const REPORT = '22222222-2222-4222-8222-222222222222';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const realEnv = { ...process.env };
beforeEach(() => {
  process.env.ORANGECAT_WEBHOOK_SECRET = SECRET;
});
afterEach(() => {
  process.env = { ...realEnv };
  vi.restoreAllMocks();
});

describe('fileLokiFinding', () => {
  it('files nothing without a project, words, or within the limit', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const base = { actorId: ACTOR, agentName: 'Thinker' };
    expect((await fileLokiFinding({ ...base, project: ' ', finding: 'x' })).ok).toBe(false);
    expect((await fileLokiFinding({ ...base, project: 'loki', finding: ' ' })).ok).toBe(false);
    expect(
      (
        await fileLokiFinding({
          ...base,
          project: 'loki',
          finding: 'x'.repeat(LOKI_FINDING_MAX_LENGTH + 1),
        })
      ).ok
    ).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('posts the contract fields, drops a non-http url, and reports filed, not fixed', async () => {
    let sent: Record<string, unknown> = {};
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      sent = JSON.parse(String((init as RequestInit).body));
      return jsonResponse(201, { ok: true, project: 'orangecat', id: REPORT, status: 'new' });
    });
    const res = await lokiFindingHandlers.file_loki_finding({} as AnySupabaseClient, 'u', ACTOR, {
      project: 'orangecat',
      finding: '  Test finding, harmless.  ',
      filed_by: 'Thinker',
      url: 'javascript:alert(1)',
    });
    expect(sent).toMatchObject({
      actorId: ACTOR,
      project: 'orangecat',
      suggestion: 'Test finding, harmless.',
      agentName: 'Thinker',
    });
    expect('url' in sent).toBe(false);
    expect(Math.abs(Date.now() - Date.parse(String(sent.issuedAt)))).toBeLessThan(60_000);
    expect(res.success).toBe(true);
    const message = (res.data as { displayMessage: string }).displayMessage;
    expect(message).toContain(`report ${REPORT}`);
    expect(message).toContain('nothing has been changed');
    expect(message).not.toMatch(/fixed|done/i);
  });

  it("relays Loki's refusal with the projects that would have worked", async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(404, { detail: 'No project named "lokey".', available: ['loki'] })
    );
    const res = await lokiFindingHandlers.file_loki_finding({} as AnySupabaseClient, 'u', ACTOR, {
      project: 'lokey',
      finding: 'x',
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain('Nothing was filed: No project named "lokey".');
  });

  it('does not report an unreadable 2xx as filed', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<html>', { status: 200 }));
    const out = await fileLokiFinding({
      actorId: ACTOR,
      project: 'loki',
      finding: 'x',
      agentName: 'QA',
    });
    expect(out.ok).toBe(false);
  });
});

describe('loki_finding_status', () => {
  it('refuses anything but a full report id before asking Loki', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const res = await lokiFindingHandlers.loki_finding_status({} as AnySupabaseClient, 'u', ACTOR, {
      report_id: 'abc',
    });
    expect(res.success).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reads the report and shows Loki's own state and reason", async () => {
    let sent: Record<string, unknown> = {};
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      sent = JSON.parse(String((init as RequestInit).body));
      return jsonResponse(200, {
        ok: true,
        id: REPORT,
        state: 'needs_you',
        label: 'Needs you',
        reason: 'Filed and waiting: the owner decides whether to build it.',
      });
    });
    const res = await lokiFindingHandlers.loki_finding_status({} as AnySupabaseClient, 'u', ACTOR, {
      report_id: REPORT,
    });
    expect(sent.feedbackId).toBe(REPORT);
    expect((res.data as { displayMessage: string }).displayMessage).toBe(
      `Report ${REPORT}: **Needs you**. Filed and waiting: the owner decides whether to build it.`
    );
  });
});
