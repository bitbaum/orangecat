/**
 * One row of "something you have": icon, title, what it is, status, arrow.
 * The My things list and the dashboard both render their rows through this,
 * so the two surfaces read as one product instead of two designs.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ENTITY_REGISTRY, type EntityType } from '@/config/entity-registry';
import { getStatusInfo } from '@/config/status-config';

interface ThingRowProps {
  type: EntityType;
  title: string;
  href: string;
  status?: string | null;
  /** The line under the title. Defaults to the type's name. */
  subtitle?: ReactNode;
}

export function ThingRow({ type, title, href, status, subtitle }: ThingRowProps) {
  const meta = ENTITY_REGISTRY[type];
  const Icon = meta.icon;
  const badge = status ? getStatusInfo(status, type) : null;
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-14 items-center gap-3 px-3 py-3 hover:bg-surface-raised"
      >
        <span className="oc-icon-tile h-10 w-10 shrink-0">
          <Icon className="h-5 w-5 text-fg-secondary" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-fg-primary">{title}</span>
          <span className="block truncate text-xs text-fg-tertiary">{subtitle ?? meta.name}</span>
        </span>
        {badge && (
          <Badge variant="outline" className={`shrink-0 ${badge.className}`}>
            {badge.label}
          </Badge>
        )}
        <ArrowRight className="h-4 w-4 shrink-0 text-fg-muted" aria-hidden="true" />
      </Link>
    </li>
  );
}

export default ThingRow;
