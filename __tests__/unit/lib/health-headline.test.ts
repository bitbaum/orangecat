/**
 * /status once read "All Systems Operational" above a red "Bitcoin
 * Integration: Outage" (production, 2026-11-12): the row was hard-coded
 * `unknown`, the page drew anything unrecognised as an outage, and the
 * headline came from the deploy gate's liveness answer, which ignores every
 * row but the database. The headline is now the worst of what is shown.
 */
import { describe, expect, it } from 'vitest';
import { headlineStatus } from '@/lib/health';

const row = (name: string, status: 'operational' | 'degraded' | 'outage' | 'unknown') => ({
  name,
  status,
});

describe('the status page headline', () => {
  it('says everything works only when every row does', () => {
    expect(
      headlineStatus({
        overall: 'operational',
        services: [row('Website', 'operational'), row('Authentication', 'operational')],
      })
    ).toBe('operational');
  });

  it('is a partial disruption when sign-in is down but the site is up', () => {
    expect(
      headlineStatus({
        overall: 'operational',
        services: [row('Database', 'operational'), row('Authentication', 'outage')],
      })
    ).toBe('degraded');
  });

  it('is an outage when the core is down', () => {
    expect(
      headlineStatus({
        overall: 'outage',
        services: [row('Database', 'outage'), row('Authentication', 'operational')],
      })
    ).toBe('outage');
  });

  it('does not count a row nobody monitors as a failure', () => {
    expect(
      headlineStatus({
        overall: 'operational',
        services: [row('Database', 'operational'), row('Something unprobed', 'unknown')],
      })
    ).toBe('operational');
  });
});
