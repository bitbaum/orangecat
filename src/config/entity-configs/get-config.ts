/**
 * Dynamic Entity Config Loader
 *
 * Provides a way to get entity configurations by type at runtime.
 * Used by AI form prefill and other dynamic features.
 *
 * Created: 2025-01-20
 */

import type { EntityType } from '@/config/entity-registry';
import type { EntityConfig } from '@/components/create/types';

import { productConfig } from './product-config';
import { serviceConfig } from './service-config';
import { causeConfig } from './cause-config';
import { loanConfig } from './loan-config';
import { investmentConfig } from './investment-config';
import { assetConfig } from './asset-config';
import { projectConfig } from './project-config';
import { aiAssistantConfig } from './ai-assistant-config';
import { eventConfig } from './event-config';
import { groupConfig } from './group-config';
import { wishlistConfig } from './wishlist-config';
import { researchWizardConfig } from './research-wizard-config';
import { documentFormConfig } from './document-form-config';
import { circleConfig } from './circle-config';

/**
 * Map of entity types to their configurations
 *
 * Note: Only includes entity types that are defined in ENTITY_TYPES
 * from entity-registry.ts.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous map: EntityConfig<T> is invariant in T (T is in callbacks), so no single T fits every entity
const ENTITY_CONFIGS: Partial<Record<EntityType, EntityConfig<any>>> = {
  product: productConfig,
  service: serviceConfig,
  cause: causeConfig,
  loan: loanConfig,
  investment: investmentConfig,
  asset: assetConfig,
  project: projectConfig,
  ai_assistant: aiAssistantConfig,
  event: eventConfig,
  group: groupConfig,
  wishlist: wishlistConfig,
  research: researchWizardConfig,
  document: documentFormConfig,
  circle: circleConfig,
};

/**
 * Get entity configuration by type
 *
 * @param entityType - The entity type to get config for
 * @returns The entity configuration or null if not found
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see ENTITY_CONFIGS above
export function getEntityConfig(entityType: EntityType): EntityConfig<any> | null {
  return ENTITY_CONFIGS[entityType] || null;
}
