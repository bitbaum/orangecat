import { CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-react';
import Link from 'next/link';
import { checkHealth } from '@/lib/health';
import { PageHeading } from '@/components/layout/PageHeading';
import { ROUTES } from '@/config/routes';
import type { ServiceStatus } from '@/lib/health';
import { APP_LOCALE } from '@/utils/locale';

export const metadata = {
  title: 'System Status',
  description: 'Current system status for OrangeCat platform services.',
};

// Revalidate every 30 seconds so stale data doesn't persist
export const revalidate = 30;

function StatusBadge({ status }: { status: ServiceStatus }) {
  if (status === 'operational') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-status-positive bg-status-positive-subtle">
        Operational
      </span>
    );
  }
  if (status === 'degraded') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-status-warning bg-status-warning-subtle">
        Degraded
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-status-negative bg-status-negative-subtle">
      Outage
    </span>
  );
}

function StatusIcon({ status, size = 'sm' }: { status: ServiceStatus; size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'w-8 h-8' : 'w-5 h-5';
  if (status === 'operational') {
    return <CheckCircle className={`${cls} text-status-positive`} />;
  }
  if (status === 'degraded') {
    return <AlertTriangle className={`${cls} text-status-warning`} />;
  }
  return <XCircle className={`${cls} text-status-negative`} />;
}

function overallMessage(status: ServiceStatus) {
  if (status === 'operational') {
    return {
      title: 'All Systems Operational',
      body: 'All OrangeCat services are running normally.',
    };
  }
  if (status === 'degraded') {
    return {
      title: 'Partial Service Disruption',
      body: 'Some services are experiencing issues. We are working to restore full functionality.',
    };
  }
  return {
    title: 'Service Outage',
    body: 'We are experiencing a service outage and are working to resolve it as quickly as possible.',
  };
}

/**
 * /status — uses the semantic status tokens (status-positive / -warning /
 * -negative) for state colors; everything else monochrome. Migration 6/N.
 */
export default async function StatusPage() {
  const report = await checkHealth();
  const { title, body } = overallMessage(report.overall);
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
            <StatusIcon status={report.overall} size="lg" />
            <div>
              <h2 className="text-2xl font-semibold text-fg-primary">{title}</h2>
              <p className="text-fg-secondary">{body}</p>
            </div>
          </div>
        </div>

        {/* Per-service Status */}
        <div className="bg-surface-base rounded-lg shadow-sm border border-default overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-default">
            <h3 className="text-lg font-semibold text-fg-primary">Services</h3>
          </div>
          <div className="divide-y divide-fg-tertiary dark:divide-fg-tertiary">
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
            <h3 className="text-lg font-semibold text-fg-primary">Recent Incidents</h3>
          </div>
          <div className="px-6 py-8 text-center">
            <Clock className="w-8 h-8 text-fg-tertiary dark:text-fg-secondary/50 mx-auto mb-3" />
            <p className="text-fg-secondary">We do not yet publish an incident history.</p>
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
                  href="mailto:support@orangecat.ch"
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
