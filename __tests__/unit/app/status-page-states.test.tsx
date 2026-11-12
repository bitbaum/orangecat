// @vitest-environment jsdom
/**
 * /status draws each service state as what it is.
 *
 * Production, 2026-11-12: the Services list showed "Bitcoin Integration" with
 * a red XCircle and a red "Outage" badge under "All Systems Operational",
 * while /api/health reported that service as 'unknown'. StatusBadge and
 * StatusIcon only matched 'operational' and 'degraded'; every other status,
 * 'unknown' included, fell through to the outage styling.
 */
import { renderToString } from 'react-dom/server';
import StatusPage from '@/app/(public)/status/page';
import type { ServiceStatus } from '@/lib/health';

const services: { name: string; status: ServiceStatus }[] = [
  { name: 'Website', status: 'operational' },
  { name: 'Unprobed Thing', status: 'unknown' },
  { name: 'Database', status: 'outage' },
];

vi.mock('@/lib/health', () => ({
  checkHealth: async () => ({
    overall: 'operational',
    timestamp: '2026-11-12T10:00:00.000Z',
    services,
  }),
}));

async function renderRows() {
  document.body.innerHTML = renderToString(await StatusPage());
  const heading = [...document.querySelectorAll('h3')].find(h => h.textContent === 'Services');
  const list = heading?.parentElement?.nextElementSibling;
  const rows = [...(list?.children ?? [])] as HTMLElement[];
  return Object.fromEntries(rows.map(r => [r.querySelector('span')?.textContent ?? '', r]));
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('/status service rows', () => {
  it('draws a service nothing probed as "Not checked", never as an outage', async () => {
    const row = (await renderRows())['Unprobed Thing'];

    expect(row.textContent).toContain('Not checked');
    expect(row.textContent).not.toContain('Outage');
    expect(row.querySelector('.text-status-negative')).toBeNull();
  });

  it('still draws a real outage red', async () => {
    const row = (await renderRows())['Database'];

    expect(row.textContent).toContain('Outage');
    expect(row.querySelector('svg')?.getAttribute('data-icon')).toBe('XCircle');
    expect(row.querySelectorAll('.text-status-negative')).toHaveLength(2);
  });

  it('draws an operational service green', async () => {
    const row = (await renderRows())['Website'];

    expect(row.textContent).toContain('Operational');
    expect(row.querySelectorAll('.text-status-positive')).toHaveLength(2);
  });
});
