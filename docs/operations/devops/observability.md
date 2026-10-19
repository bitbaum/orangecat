# Observability

Health

- `GET /api/health` (`src/app/api/health/route.ts`, checks in `src/lib/health.ts`)
  returns `status` (`healthy` / `unhealthy`), a per-service status map (website,
  API, database, authentication, Bitcoin integration) and box resource pressure
  (`host`, from `src/lib/host-metrics.ts`) for the off-box uptime monitor. 200
  when every service is operational, 503 otherwise.

Metrics (Prometheus)

- There is no `/api/metrics` route in the app today. The `orangecat-web` job in
  `deployment/production/monitoring/prometheus.yml` still scrapes that path, so it
  finds nothing until a metrics route is added.

Logs (Loki + Promtail)

- Promtail scrapes Docker JSON logs and ships to Loki.
- Grafana dashboards/datasources provisioned under `deployment/production/monitoring/grafana/`.

CSP Reporting

- There is no `/api/csp-report` route and no report-only CSP toggle in the app
  today; CSP violations are not collected.
