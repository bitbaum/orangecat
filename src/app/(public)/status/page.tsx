import { CheckCircle, AlertTriangle, XCircle, Clock, Minus } from 'lucide-react';
import Link from 'next/link';
import { checkHealth, headlineStatus } from '@/lib/health';
import { PageHeading } from '@/components/layout/PageHeading';
import { ROUTES } from '@/config/routes';
import { CONTACT_EMAIL } from '@/config/brand';
import type { LucideIcon } from 'lucide-react';
import type { MeasuredStatus, ServiceStatus } from '@/lib/health';
import { APP_LOCALE } from '@/utils/locale';

export const metadata = {
  title: 'System Status',
  description: 'Current system status for OrangeCat platform services.',
};

// Revalidate every 30 seconds so stale data doesn't persist
export const revalidate = 30;

/* One entry per state, typed so a new state cannot compile without one. The
   if-chain this replaces ended in a fallthrough, and the fallthrough drew a
   service nobody probes as a red "Outage". */
const STATUS_VIEW: Record<
  ServiceStatus,
  { label: string; Icon: LucideIcon; icon: string; badge: string }
> = {
  operational: {
    label: 'Operational',
    Icon: CheckCircle,
    icon: 'text-status-positive',
    badge: 'text-status-positive bg-status-positive-subtle',
  },
  degraded: {
    label: 'Degraded',
    Icon: AlertTriangle,
    icon: 'text-status-warning',
    badge: 'text-status-warning bg-status-warning-subtle',
  },
  outage: {
    label: 'Outage',
    Icon: XCircle,
    icon: 'text-status-negative',
    badge: 'text-status-negative bg-status-negative-subtle',
  },
  unknown: {
    label: 'Not monitored',
    Icon: Minus,
    icon: 'text-fg-secondary',
    badge: 'text-fg-secondary bg-surface-raised',
  },
};

const HEADLINE: Record<MeasuredStatus, { title: string; body: string }> = {
  operational: {
    title: 'All Systems Operational',
    body: 'All OrangeCat services are running normally.',
  },
  degraded: {
    title: 'Partial Service Disruption',
    body: 'Some services are experiencing issues. We are working to restore full functionality.',
  },
  outage: {
    title: 'Service Outage',
    body: 'We are experiencing a service outage and are working to resolve it as quickly as possible.',
  },
};

function StatusBadge({ status }: { status: ServiceStatus }) {
  const { label, badge } = STATUS_VIEW[status];
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge}`}
    >
      {label}
    </span>
  );
}

function StatusIcon({ status, size = 'sm' }: { status: ServiceStatus; size?: 'sm' | 'lg' }) {
  const { Icon, icon } = STATUS_VIEW[status];
  const box = size === 'lg' ? 'w-8 h-8' : 'w-5 h-5';
  return <Icon className={`${box} shrink-0 ${icon}`} aria-hidden="true" />;
}

/**
 * /status — uses the semantic status tokens (status-positive / -warning /
 * -negative) for state colors; everything else monochrome. Migration 6/N.
 */
export default async function StatusPage() {
  const report = await checkHealth();
  const headline = headlineStatus(report);
  const { title, body } = HEADLINE[headline];
  const checkedAt = new Date(report.timestamp).toLocaleTimeString(APP_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  return (
    <div className="min-h-screen bg-surface-page">
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <PageHeading className="mb-4">System Status</PageHeading>
          <p className="text-xl text-fg-secondary">Current status of OrangeCat platform services</p>
          <p className="text-sm text-fg-tertiary mt-2">Last checked: {checkedAt}</p>
        </div>

        {/* Overall Status */}
        <div className="bg-surface-base rounded-lg shadow-sm border border-default p-6 mb-8">
          <div className="flex items-center space-x-3">
            <StatusIcon status={headline} size="lg" />
            <div>
              <h2 className="mb-1 text-2xl font-semibold text-fg-primary">{title}</h2>
              <p className="mb-0 text-fg-secondary">{body}</p>
            </div>
          </div>
        </div>

        {/* Per-service Status */}
        <div className="bg-surface-base rounded-lg shadow-sm border border-default overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-default">
            <h3 className="mb-0 text-lg font-semibold text-fg-primary">Services</h3>
          </div>
          <div className="divide-y divide-subtle">
            {report.services.map(service => (
              <div key={service.name} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <StatusIcon status={service.status} />
                  <span className="font-medium text-fg-primary">{service.name}</span>
                </div>
                <StatusBadge status={service.status} />
              </div>
            ))}
          </div>
        </div>

        {/* Incident History */}
        <div className="bg-surface-base rounded-lg shadow-sm border border-default overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-default">
            <h3 className="mb-0 text-lg font-semibold text-fg-primary">Recent Incidents</h3>
          </div>
          <div className="px-6 py-8 text-center">
            <Clock className="w-8 h-8 text-fg-tertiary mx-auto mb-3" aria-hidden="true" />
            <p className="mb-0 text-fg-secondary">We do not yet publish an incident history.</p>
          </div>
        </div>

        {/* Contact — neutral panel per migration 6/N */}
        <div className="bg-surface-raised/40 border border-subtle rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-fg-secondary mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-semibold text-fg-primary mb-1">Experiencing Issues?</h3>
              <p className="text-fg-secondary mb-4">
                If you&apos;re experiencing problems, check our FAQ or reach out to support.
              </p>
              <div className="flex gap-4">
                <Link
                  href={ROUTES.FAQ}
                  className="text-fg-primary hover:text-fg-primary font-medium underline-offset-4 hover:underline"
                >
                  Visit FAQ →
                </Link>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="text-fg-primary hover:text-fg-primary font-medium underline-offset-4 hover:underline"
                >
                  Contact Support →
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
