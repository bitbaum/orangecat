'use client';

import { useRouter } from 'next/navigation';
import Loading from '@/components/Loading';
import { EntityCreationWizard } from '@/components/create';
import { EntityForm } from '@/components/create/EntityForm';
import { getEntityMetadata, type EntityType } from '@/config/entity-registry';
import { useEntityCreateEdit } from '@/hooks/useEntityCreateEdit';
import type { EntityConfig } from './types';

interface EntityCreateEditPageProps<T extends Record<string, unknown>> {
  entityType: EntityType;
  config: EntityConfig<T>;
}

export function EntityCreateEditPage<T extends Record<string, unknown>>({
  entityType,
  config,
}: EntityCreateEditPageProps<T>) {
  const router = useRouter();
  const meta = getEntityMetadata(entityType);
  const { editId, entityData, loading, editError, initialData } =
    useEntityCreateEdit<T>(entityType);

  if (loading) {
    return (
      <Loading
        fullScreen
        message={editId ? `Loading ${meta.name.toLowerCase()}...` : 'Loading...'}
      />
    );
  }

  if (editId && editError) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <h3 className="text-lg font-semibold mb-2">{editError}</h3>
        <p className="text-fg-secondary mb-4">
          Unable to load {meta.name.toLowerCase()} for editing.
        </p>
        <button
          onClick={() => router.push(meta.basePath)}
          className="text-sm font-medium text-fg-secondary hover:text-fg-primary underline"
        >
          Back to {meta.namePlural.toLowerCase()}
        </button>
      </div>
    );
  }

  if (editId && entityData) {
    return <EntityForm config={config} initialValues={entityData} mode="edit" entityId={editId} />;
  }

  return <EntityCreationWizard<T> config={config} initialData={initialData} />;
}
