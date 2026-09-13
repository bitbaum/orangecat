/**
 * Project activity — the reader must point at the store activity lands in.
 *
 * Visitor report (2026-08-24): a project with 23 agent runs behind it rendered
 * "No recent activity yet". The link was never broken — `timeline_events` held
 * 17 published Loki updates for that project while the page read
 * `project_updates`, a table with zero rows platform-wide and no writer. These
 * tests pin the reader to timeline_events and pin the mapping the card needs.
 */

import { listProjectActivity } from '@/services/projects/activity';
import { projectActivityKind } from '@/config/project-activity';
import { isProjectPubliclyVisible } from '@/config/project-statuses';
import { DATABASE_TABLES } from '@/config/database-tables';

interface Capture {
  table?: string;
  filters: Array<[string, unknown]>;
}

function stubDb(rows: unknown[], capture: Capture) {
  // supabase-js keeps the builder chainable until it is awaited, so the stub
  // has to stay chainable after limit() and resolve only on await.
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: (col: string, val: unknown) => {
      capture.filters.push([col, val]);
      return chain;
    },
    order: () => chain,
    limit: () => chain,
    then: (resolve: (v: unknown) => unknown) => resolve({ data: rows, error: null }),
  };
  return {
    from: (table: string) => {
      capture.table = table;
      return chain;
    },
  } as never;
}

const row = {
  id: 'evt-1',
  event_type: 'project_updated',
  title: 'loki: shipped the seam',
  description: 'Deploy green.',
  amount_btc: null,
  event_timestamp: '2026-08-03T09:00:01.777Z',
  created_at: '2026-08-03T09:05:00.000Z',
  metadata: {
    is_external_publish: true,
    source: 'loki',
    source_url: 'https://loki.orangecat.ch/changelog/1',
  },
};

describe('listProjectActivity', () => {
  it('reads timeline_events, not the never-written project_updates table', async () => {
    const capture: Capture = { filters: [] };
    await listProjectActivity(stubDb([row], capture), 'p-1', { includeNonPublic: false });

    expect(capture.table).toBe(DATABASE_TABLES.TIMELINE_EVENTS);
    expect(capture.table).not.toBe(DATABASE_TABLES.PROJECT_UPDATES);
  });

  it('scopes to the project and hides deleted events', async () => {
    const capture: Capture = { filters: [] };
    await listProjectActivity(stubDb([], capture), 'p-1', { includeNonPublic: false });

    expect(capture.filters).toEqual(
      expect.arrayContaining([
        ['subject_type', 'project'],
        ['subject_id', 'p-1'],
        ['is_deleted', false],
      ])
    );
  });

  it('shows only public events to visitors, all of them to the owner', async () => {
    const pub: Capture = { filters: [] };
    await listProjectActivity(stubDb([], pub), 'p-1', { includeNonPublic: false });
    expect(pub.filters).toContainEqual(['visibility', 'public']);

    const owner: Capture = { filters: [] };
    await listProjectActivity(stubDb([], owner), 'p-1', { includeNonPublic: true });
    expect(owner.filters.map(([c]) => c)).not.toContain('visibility');
  });

  it('carries the publishing product through as attribution', async () => {
    const result = await listProjectActivity(stubDb([row], { filters: [] }), 'p-1', {
      includeNonPublic: false,
    });

    expect(result.success).toBe(true);
    expect(result.data?.[0]).toMatchObject({
      id: 'evt-1',
      project_id: 'p-1',
      type: 'update',
      title: 'loki: shipped the seam',
      content: 'Deploy green.',
      created_at: row.event_timestamp,
      source: { label: 'Loki', url: 'https://loki.orangecat.ch/changelog/1' },
    });
  });

  it('leaves ordinary posts unattributed', async () => {
    const plain = { ...row, metadata: {} };
    const result = await listProjectActivity(stubDb([plain], { filters: [] }), 'p-1', {
      includeNonPublic: false,
    });

    expect(result.data?.[0].source).toBeUndefined();
  });

  it('reports a query failure instead of pretending the project is idle', async () => {
    const failing = (() => {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        then: (resolve: (v: unknown) => unknown) =>
          resolve({ data: null, error: { message: 'boom' } }),
      };
      return { from: () => chain } as never;
    })();

    const result = await listProjectActivity(failing, 'p-1', { includeNonPublic: true });
    expect(result).toEqual({ success: false, error: 'boom' });
  });
});

describe('projectActivityKind', () => {
  it('treats an event carrying money as a donation whatever its type', () => {
    expect(projectActivityKind('project_updated', 0.001)).toBe('donation');
  });

  it('marks the milestone-shaped events', () => {
    expect(projectActivityKind('project_milestone')).toBe('milestone');
    expect(projectActivityKind('project_goal_reached')).toBe('milestone');
    expect(projectActivityKind('project_completed')).toBe('milestone');
  });

  it('falls back to a plain update', () => {
    expect(projectActivityKind('project_updated')).toBe('update');
    expect(projectActivityKind('something_new')).toBe('update');
  });
});

describe('isProjectPubliclyVisible', () => {
  // Mirrors the projects_public_read RLS policy; drift here silently changes
  // who can read a project's activity.
  it.each([
    ['active', true],
    ['completed', true],
    ['draft', false],
    ['paused', false],
    ['cancelled', false],
  ])('%s -> %s', (status, expected) => {
    expect(isProjectPubliclyVisible(status)).toBe(expected);
  });

  it('treats a missing status as not public', () => {
    expect(isProjectPubliclyVisible(null)).toBe(false);
  });
});
