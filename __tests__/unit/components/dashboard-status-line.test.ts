import { describe, expect, it } from 'vitest';
import { dashboardStatusLine } from '@/components/dashboard/sections/DashboardHeader';

// The line under the dashboard greeting answers "does anything need me?".
describe('dashboardStatusLine', () => {
  it('says plainly when nothing is waiting', () => {
    expect(dashboardStatusLine(0, 0)).toBe('Nothing is waiting on you.');
  });
  it('counts what waits and the unpublished drafts', () => {
    expect(dashboardStatusLine(1, 0)).toBe('1 thing needs you');
    expect(dashboardStatusLine(2, 3)).toBe('2 things need you · 3 unpublished drafts');
    expect(dashboardStatusLine(0, 1)).toBe('1 unpublished draft');
  });
});
