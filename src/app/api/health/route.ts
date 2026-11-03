import { apiSuccess, apiServiceUnavailable } from '@/lib/api/standardResponse';
import { checkHealth } from '@/lib/health';
import { getHostMetrics } from '@/lib/host-metrics';
import { getCatCompletionHealth } from '@/services/cat/completion-health';

const CACHE = 'public, s-maxage=10, stale-while-revalidate=30';

// GET /api/health - lightweight liveness/readiness endpoint
export async function GET() {
  const [report, host] = await Promise.all([checkHealth(), getHostMetrics()]);
  const healthy = report.overall === 'operational';

  const body = {
    status: healthy ? 'healthy' : 'unhealthy',
    scope: 'liveness',
    timestamp: report.timestamp,
    ai: getCatCompletionHealth(),
    services: Object.fromEntries(
      report.services.map(s => [s.name.toLowerCase().replace(' ', '_'), s.status])
    ),
    // Box resource pressure — surfaced for the off-box uptime monitor to alert on.
    host,
  };

  const response = healthy
    ? apiSuccess(body)
    : apiServiceUnavailable('One or more services degraded', body);
  response.headers.set('Cache-Control', CACHE);
  return response;
}
