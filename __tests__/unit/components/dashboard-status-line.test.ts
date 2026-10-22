import { describe, expect, it } from 'vitest';
import { dashboardStatusLine } from '@/components/dashboard/sections/DashboardHeader';

// The line under the dashboard greeting answers "does anything need me?".
describe('dashboardStatusLine', () => {
  it('says plainly when nothing is waiting', () => {
    expect(dashboardStatusLine(0, 0)).toBe('No pending Cat approvals.');
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
