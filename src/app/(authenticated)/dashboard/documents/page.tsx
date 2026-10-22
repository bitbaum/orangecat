'use client';

import { BrandMarkIcon } from '@/components/shell/BrandMarkIcon';
import EntityDashboardPage from '@/components/entity/EntityDashboardPage';
import { documentEntityConfig, type DocumentListItem } from '@/config/entities/documents';

/**
 * Documents Dashboard Page
 *
 * Manage documents that provide context for My Cat AI assistant.
 *
 * Created: 2026-01-20
 * Last Modified: 2026-02-24
 * Last Modified Summary: Migrated to EntityDashboardPage for consistent UX (adds delete, error handling, bulk selection)
 */

function CatInfoBanner() {
  return (
    <div className="mb-4 rounded-md border border-subtle bg-surface-raised/30 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-md border border-subtle bg-surface-page p-2">
          <BrandMarkIcon className="h-5 w-5 text-fg-primary" />
        </div>
        <div>
          <h3 className="font-medium text-fg-primary">Help your Cat understand you</h3>
          <p className="mt-1 text-sm text-fg-secondary">
            Add documents about your goals, skills, financial situation, or business plans. Only
            documents marked <span className="font-medium">&ldquo;Cat Only&rdquo;</span> or{' '}
            <span className="font-medium">&ldquo;Public&rdquo;</span> are visible to your Cat.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <EntityDashboardPage<DocumentListItem>
      config={documentEntityConfig}
      title="Cat Context"
      description="Add documents to help your Cat understand your goals, skills, and situation"
      createButtonLabel="Add Context"
      headerContent={<CatInfoBanner />}
    />
  );
}
