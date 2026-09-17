import { createServerClient } from '@/lib/supabase/server';
import { DATABASE_TABLES } from '@/config/database-tables';

export type ServiceStatus = 'operational' | 'degraded' | 'outage';

interface ServiceHealth {
  name: string;
  status: ServiceStatus;
}

interface HealthReport {
  overall: ServiceStatus;
  timestamp: string;
  services: ServiceHealth[];
}

const PROBE_TIMEOUT_MS = 3000;

// Bound every probe so one slow dependency can't hang the health endpoint (and
// thus the uptime monitor). A timed-out probe is treated as failed by its caller.
async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    t = setTimeout(() => reject(new Error('probe timeout')), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(t!);
  }
}

// Real round-trip to the DB (not an inference). Any error/timeout = outage.
async function probeDatabase(): Promise<ServiceStatus> {
  try {
    const supabase = await createServerClient();
    const { error } = await withTimeout(
      Promise.resolve(supabase.from(DATABASE_TABLES.PROFILES).select('id').limit(1)),
      PROBE_TIMEOUT_MS
    );
    return error ? 'outage' : 'operational';
  } catch {
    return 'outage';
  }
}

// Probe GoTrue directly — auth can be down while the DB is up (the old code
// inferred "db up ⇒ auth up", which hid a GoTrue-only outage). The self-host's
// Kong gateway enforces `apikey` on /auth/v1/* (401 without it), so the probe
// MUST send the anon key — otherwise it always reads 'outage'.
async function probeAuth(): Promise<ServiceStatus> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apikey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!base) {
    return 'outage';
  }
  try {
    const res = await withTimeout(
      fetch(`${base}/auth/v1/health`, {
        cache: 'no-store',
        headers: apikey ? { apikey } : {},
      }),
      PROBE_TIMEOUT_MS
    );
    return res.ok ? 'operational' : 'outage';
  } catch {
    return 'outage';
  }
}

// No cache probe: rate limiting runs in-process (limitkit's bounded
// MemoryStore) since the Upstash path — never configured in production — was
// deleted with the limitkit adoption. There is no cache dependency to probe,
// and a hard-coded "operational" row would be a fake metric.

export async function checkHealth(): Promise<HealthReport> {
  const timestamp = new Date().toISOString();

  const [dbStatus, authStatus] = await Promise.all([probeDatabase(), probeAuth()]);

  const services: ServiceHealth[] = [
    // Website + API are trivially operational: this endpoint is serving the request.
    { name: 'Website', status: 'operational' },
    { name: 'API', status: 'operational' },
    { name: 'Database', status: dbStatus },
    { name: 'Authentication', status: authStatus },
    { name: 'Bitcoin Integration', status: 'operational' },
  ];

  // The 200/503 that the DEPLOY health-gate and uptime monitor key on reflects
  // core LIVENESS only: the app is serving + the DB is reachable. Auth is
  // probed and reported in `services` for visibility, but a GoTrue blip
  // must NOT flip the endpoint to 503 — that would roll back a healthy deploy (it
  // did: a bugged auth probe took every deploy down). Alert on a real auth outage
  // off this critical path (uptime.yml reads services.authentication).
  const overall: ServiceStatus = dbStatus === 'outage' ? 'outage' : 'operational';

  return { overall, timestamp, services };
}
