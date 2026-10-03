/**
 * The roadmap as a journey: what is behind us, where we are, what is ahead.
 *
 * Pure — /roadmap renders it, the test pins it. The record is the fleet map
 * (ROADMAP.md read into Loki's map); nothing here invents progress. A
 * percentage counts only ticked steps — legacy string steps carry no tick and
 * are listed but not counted — and an item with nothing to count shows no
 * number. Loki's /roadmap draws the same journey (bitbaum/loki
 * src/lib/register/roadmap-journey.ts); the natural single home for both is
 * bip-kit/react.
 */
import { milestoneParts, type RoadmapItem } from '@/lib/development/records';

export type JourneyPhase = 'shipped' | 'now' | 'next' | 'later';

export interface JourneyStep {
  title: string;
  done: boolean | null;
}

export interface JourneyStop {
  title: string;
  phase: JourneyPhase;
  targetDate: string | null;
  done: number;
  /** Steps that carry a tick either way; legacy text steps are not counted. */
  countable: number;
  percent: number | null;
  nextStep: string | null;
  steps: JourneyStep[];
}

export interface Journey {
  shipped: JourneyStop[];
  now: JourneyStop[];
  next: JourneyStop[];
  later: JourneyStop[];
  stepsDone: number;
  stepsTotal: number;
  percentShipped: number;
}

const PHASES: { phase: JourneyPhase; matches: string[] }[] = [
  { phase: 'now', matches: ['in progress', 'active', 'doing'] },
  { phase: 'next', matches: ['planned', 'next', 'soon'] },
  { phase: 'later', matches: ['later', 'someday', 'future'] },
  { phase: 'shipped', matches: ['done', 'shipped', 'delivered'] },
];

export function phaseOf(status: string | null): JourneyPhase {
  const s = (status ?? '').trim().toLowerCase();
  return PHASES.find(p => p.matches.includes(s))?.phase ?? 'next';
}

export function toStop(item: RoadmapItem): JourneyStop {
  const steps = item.milestones.map(milestoneParts);
  const countable = steps.filter(s => s.done !== null).length;
  const done = steps.filter(s => s.done === true).length;
  const phase = phaseOf(item.status);
  return {
    title: item.title,
    phase,
    targetDate: item.targetDate,
    done,
    countable,
    percent:
      phase === 'shipped'
        ? 100
        : countable > 0
          ? Math.round((done / countable) * 100)
          : (item.progress ?? null),
    nextStep: steps.find(s => s.done !== true)?.title ?? null,
    steps,
  };
}

export function buildJourney(items: readonly RoadmapItem[]): Journey {
  const stops = items.map(toStop);
  const by = (p: JourneyPhase) => stops.filter(s => s.phase === p);
  const road = stops.filter(s => s.phase !== 'shipped');
  const shipped = by('shipped');
  return {
    shipped,
    now: by('now'),
    next: by('next'),
    later: by('later'),
    stepsDone: road.reduce((n, s) => n + s.done, 0),
    stepsTotal: road.reduce((n, s) => n + s.countable, 0),
    percentShipped: stops.length ? Math.round((shipped.length / stops.length) * 100) : 0,
  };
}
