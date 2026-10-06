import { buildJourney, phaseOf, toStop } from '@/lib/development/roadmap-journey';
import type { RoadmapItem } from '@/lib/development/records';

const item = (
  title: string,
  status: string | null,
  milestones: RoadmapItem['milestones'] = [],
  progress: number | null = null
): RoadmapItem => ({ title, status, progress, targetDate: null, milestones });

describe('roadmap journey', () => {
  it('maps statuses to phases, unknown reads as next', () => {
    expect(phaseOf('in progress')).toBe('now');
    expect(phaseOf('Shipped')).toBe('shipped');
    expect(phaseOf(null)).toBe('next');
  });

  it('counts only ticked steps; legacy text steps are listed, not counted', () => {
    const s = toStop(
      item('Chat', 'in progress', [
        { title: 'a', done: true },
        { title: 'b', done: false },
        'legacy',
      ])
    );
    expect(s.done).toBe(1);
    expect(s.countable).toBe(2);
    expect(s.percent).toBe(50);
    expect(s.nextStep).toBe('b');
    expect(s.steps).toHaveLength(3);
  });

  it('never invents a number; falls back to recorded progress only', () => {
    expect(toStop(item('x', 'planned')).percent).toBeNull();
    expect(toStop(item('x', 'planned', [], 40)).percent).toBe(40);
    expect(toStop(item('x', 'done')).percent).toBe(100);
  });

  it('headline is shipped over all items; steps counted on the road only', () => {
    const j = buildJourney([
      item('A', 'done', [{ title: '1', done: true }]),
      item('B', 'in progress', [
        { title: '1', done: true },
        { title: '2', done: false },
      ]),
      item('C', 'later'),
    ]);
    expect(j.percentShipped).toBe(33);
    expect(j.stepsDone).toBe(1);
    expect(j.stepsTotal).toBe(2);
    expect(buildJourney([]).percentShipped).toBe(0);
  });
});
