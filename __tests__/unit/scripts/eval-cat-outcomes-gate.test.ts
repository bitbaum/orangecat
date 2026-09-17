/**
 * The nightly Cat outcome gate paged every night with
 *
 *   "GATE FAILED: assistant messages exist in the window but 0 Cat actions were
 *    logged — the cat_action_log write path looks dead"
 *
 * while cat_action_log held ten rows for that window, the newest from
 * 2026-08-25. The write path was alive; the gate had never looked at it. Its
 * predicate counted only rows that are BOTH status=completed AND a create_*
 * action, found none, and reported a cause it had not tested — the single
 * create_* in the window was `create_cause`, DENIED.
 *
 * That mattered twice over: it woke a human nightly for a non-event, and a
 * tripwire that cries every night is one nobody believes on the night it is
 * right — which is exactly the failure this gate exists to catch.
 *
 * Run in a child process against the real module, matching eval-cat-retry's
 * pattern: the thing worth protecting is the behaviour of the shipped file,
 * not the presence of a keyword in its source.
 */

import { execFileSync } from 'child_process';
import path from 'path';

const MODULE_URL = `file://${path.join(process.cwd(), 'scripts/eval-cat-outcomes.mjs')}`;

function verdict(input: Record<string, unknown>): { fail: boolean; message: string } {
  const script = `
    const { gateVerdict } = await import('${MODULE_URL}');
    console.log(JSON.stringify(gateVerdict(${JSON.stringify(input)})));
  `;
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 30_000,
    env: { ...process.env, NODE_OPTIONS: '' },
  });
  return JSON.parse(out.trim().split('\n').pop()!);
}

describe('eval-cat-outcomes gate predicate', () => {
  it('importing the module neither runs the report nor exits', () => {
    // main() is guarded to direct execution. Without that, the predicate could
    // not be reached from a test at all — which is why it stayed wrong.
    const out = execFileSync(
      process.execPath,
      ['--input-type=module', '-e', `await import('${MODULE_URL}'); console.log('imported');`],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 30_000, env: { ...process.env, NODE_OPTIONS: '' } }
    );
    expect(out).toContain('imported');
    expect(out).not.toContain('Cat outcome funnel');
  });

  it('passes when completed creates exist', () => {
    expect(verdict({ proposed: 3, hasAssistantActivity: true, logRows: [] }).fail).toBe(false);
  });

  it('passes when the Cat was never active in the window', () => {
    const v = verdict({ proposed: 0, hasAssistantActivity: false, logRows: [] });
    expect(v.fail).toBe(false);
    expect(v.message).toMatch(/nothing to grade/);
  });

  it('FAILS only when the log is EMPTY while the Cat is talking — the real bug', () => {
    const v = verdict({ proposed: 0, hasAssistantActivity: true, logRows: [] });
    expect(v.fail).toBe(true);
    expect(v.message).toMatch(/EMPTY/);
  });

  it('does NOT fail when the log has rows but none is a completed create_*', () => {
    // The exact 2026-08-29 window that paged: writes happening, no completed create.
    const v = verdict({
      proposed: 0,
      hasAssistantActivity: true,
      logRows: [
        { action_id: 'publish_entity', status: 'denied' },
        { action_id: 'update_profile', status: 'completed' },
        { action_id: 'create_cause', status: 'denied' },
        { action_id: 'add_wallet', status: 'denied' },
        { action_id: 'send_payment', status: 'failed' },
      ],
    });
    expect(v.fail).toBe(false);
    expect(v.message).toMatch(/write path is alive/);
  });

  it('surfaces denials as an observation rather than swallowing them', () => {
    const v = verdict({
      proposed: 0,
      hasAssistantActivity: true,
      logRows: [
        { action_id: 'create_cause', status: 'denied' },
        { action_id: 'publish_entity', status: 'denied' },
      ],
    });
    expect(v.fail).toBe(false);
    expect(v.message).toMatch(/2 were DENIED/);
  });

  it('a single row of any kind disproves "nothing is written"', () => {
    const v = verdict({
      proposed: 0,
      hasAssistantActivity: true,
      logRows: [{ action_id: 'forget_memories', status: 'completed' }],
    });
    expect(v.fail).toBe(false);
  });
});
