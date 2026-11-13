import { describe, expect, it } from 'vitest';
import {
  FIRST_RUN_LINE,
  dashboardStatusLine,
} from '@/components/dashboard/sections/DashboardHeader';

// The line under the dashboard greeting answers "does anything need me?".
describe('dashboardStatusLine', () => {
  it('says nothing to a named account when nothing is waiting', () => {
    expect(dashboardStatusLine(0, 0)).toBeNull();
    expect(dashboardStatusLine(0, 0, true)).toBeNull();
  });
  it('tells a person it does not know yet what to do first', () => {
    // "No pending Cat approvals." spoke to someone who already had things.
    expect(dashboardStatusLine(0, 0, false)).toBe(FIRST_RUN_LINE);
  });
  it('does not announce an empty state before approvals load', () => {
    expect(dashboardStatusLine(undefined, 0)).toBe('Checking Cat approvals…');
  });
  it('counts what waits and the unpublished drafts', () => {
    expect(dashboardStatusLine(1, 0)).toBe('1 pending Cat approval');
    expect(dashboardStatusLine(2, 3)).toBe('2 pending Cat approvals · 3 unpublished drafts');
    expect(dashboardStatusLine(0, 1)).toBe('1 unpublished draft');
  });
});
