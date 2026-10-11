import { EntityConfig } from '@/types/entity';
import { ResearchEntity } from '@/types/research';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import Button from '@/components/ui/Button';
import { GRADIENTS } from '@/config/gradients';

export const researchEntityConfig: EntityConfig<ResearchEntity> = {
  name: ENTITY_REGISTRY['research'].name,
  namePlural: ENTITY_REGISTRY['research'].namePlural,
  colorTheme: ENTITY_REGISTRY['research'].colorTheme,

  listPath: ENTITY_REGISTRY['research'].basePath,
  detailPath: id => `${ENTITY_REGISTRY['research'].basePath}/${id}`,
  createPath: ENTITY_REGISTRY['research'].createPath,
  editPath: id => `${ENTITY_REGISTRY['research'].createPath}?edit=${id}`,

  entityType: ENTITY_REGISTRY['research'].type,
  apiEndpoint: ENTITY_REGISTRY['research'].apiEndpoint,

  makeHref: entity => `${ENTITY_REGISTRY['research'].basePath}/${entity.id}`,

  makeCardProps: entity => ({
    badge: entity.status ? String(entity.status) : undefined,
    metadata: entity.field ? (
      <span className="text-xs text-fg-secondary capitalize">
        {String(entity.field).replace(/_/g, ' ')}
      </span>
    ) : undefined,
    showEditButton: true,
    editHref: `${ENTITY_REGISTRY['research'].createPath}?edit=${entity.id}`,
  }),

  emptyState: {
    title: 'No research entities yet',
    description: 'Start your first research project with decentralized funding.',
    action: (
      <Button href={ENTITY_REGISTRY['research'].createPath} className={GRADIENTS.brandTiffany}>
        Create Research
      </Button>
    ),
  },

  gridCols: { mobile: 1, tablet: 2, desktop: 3 },
};
