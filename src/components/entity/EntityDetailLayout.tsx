'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem, BreadcrumbRoot } from '@/components/ui/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';

interface EntityDetailLayoutProps {
  title: string;
  subtitle?: string;
  headerActions?: ReactNode;
  left: ReactNode;
  right?: ReactNode;
  className?: string;
  breadcrumbItems?: BreadcrumbItem[];
  breadcrumbRoot?: BreadcrumbRoot;
}

export default function EntityDetailLayout({
  title,
  subtitle,
  headerActions,
  left,
  right,
  className,
  breadcrumbItems,
  breadcrumbRoot,
}: EntityDetailLayoutProps) {
  return (
    <div className={cn('oc-page', className)}>
      <div className="oc-page-container oc-page-stack">
        <PageHeader
          title={title}
          subtitle={subtitle}
          breadcrumbs={breadcrumbItems}
          breadcrumbRoot={breadcrumbRoot}
          actions={headerActions}
        />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">{left}</div>
          <div>{right}</div>
        </div>
      </div>
    </div>
  );
}
