#!/usr/bin/env tsx
/**
 * CLI Entity Creation Utility
 *
 * Allows creating any entity type (products, services, organizations, etc.)
 * from the command line or programmatically.
 *
 * Usage:
 *   npm run create-entity -- --type organization --name "BitBaum AG" --description "Swiss Bitcoin company"
 *   npm run create-entity -- --type product --title "Coffee Mug" --price 25000
 *
 * Created: 2025-12-27
 * Last Modified: 2025-12-27
 * Last Modified Summary: CLI utility for entity creation including organizations
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Entity type mapping
const ENTITY_ENDPOINTS: Record<string, string> = {
  product: '/api/products',
  service: '/api/services',
  cause: '/api/causes',
  loan: '/api/loans',
  project: '/api/projects',
  asset: '/api/assets',
  ai_assistant: '/api/ai-assistants',
  organization: '/api/organizations',
  circle: '/api/circles',
};

/**
 * Create an entity via API
 */
async function createEntity(
  entityType: string,
  data: Record<string, any>,
  userId?: string
): Promise<any> {
  const endpoint = ENTITY_ENDPOINTS[entityType];
  if (!endpoint) {
    throw new Error(`Unknown entity type: ${entityType}`);
  }

  // For organizations, we need special handling
  if (entityType === 'organization') {
    return createOrganization(data, userId);
  }

  // For other entities, use the standard API pattern
  const tableName = getTableName(entityType);
  const { data: entity, error } = await supabase
    .from(tableName)
    .insert({
      ...data,
      user_id: userId || (await getCurrentUserId()),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create ${entityType}: ${error.message}`);
  }

  return entity;
}

/**
 * Create an organization (special handling)
 */
async function createOrganization(data: Record<string, any>, userId?: string) {
  const actualUserId = userId || (await getCurrentUserId());

  // Organizations use a different structure
  const orgData = {
    name: data.name || data.title,
    slug: data.slug || generateSlug(data.name || data.title),
    description: data.description || '',
    type: data.type || 'company',
    website: data.website || '',
    location: data.location || '',
    tags: data.tags || [],
    governance_model: data.governance_model || 'democratic',
    is_public: data.is_public ?? true,
    requires_approval: data.requires_approval ?? false,
    created_by: actualUserId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: organization, error } = await supabase
    .from('organizations')
    .insert(orgData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create organization: ${error.message}`);
  }

  // Add creator as stakeholder
  if (actualUserId) {
    await supabase.from('organization_stakeholders').insert({
      organization_id: organization.id,
      user_id: actualUserId,
      role: 'founder',
      stake_percentage: 100,
      voting_power: 100,
      joined_at: new Date().toISOString(),
    });
  }

  return organization;
}

/**
 * Get current user ID (or use service account)
 */
async function getCurrentUserId(): Promise<string | null> {
  // Try to get from environment or use service account
  const userId = process.env.ORANGECAT_USER_ID;
  if (userId) return userId;

  // For CLI, we might need to authenticate
  // For now, return null and let the API handle it
  return null;
}

/**
 * Get table name for entity type
 */
function getTableName(entityType: string): string {
  const mapping: Record<string, string> = {
    product: 'user_products',
    service: 'user_services',
    cause: 'user_causes',
    loan: 'loans',
    project: 'projects',
    asset: 'assets',
    ai_assistant: 'ai_assistants',
    circle: 'circles',
  };
  return mapping[entityType] || entityType;
}

/**
 * Generate slug from name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Parse command line arguments
 */
function parseArgs(): { entityType: string; data: Record<string, any>; userId?: string } {
  const args = process.argv.slice(2);
  const data: Record<string, any> = {};
  let entityType = '';
  let userId: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--type' || arg === '-t') {
      entityType = args[++i];
    } else if (arg === '--user-id' || arg === '-u') {
      userId = args[++i];
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = args[++i];
      // Try to parse as number or boolean
      if (value === 'true') data[key] = true;
      else if (value === 'false') data[key] = false;
      else if (!isNaN(Number(value))) data[key] = Number(value);
      else data[key] = value;
    }
  }

  if (!entityType) {
    throw new Error('Entity type is required (--type or -t)');
  }

  return { entityType, data, userId };
}

/**
 * Main CLI entry point
 */
async function main() {
  try {
    const { entityType, data, userId } = parseArgs();

    console.log(`🚀 Creating ${entityType}...`);
    console.log('📝 Data:', JSON.stringify(data, null, 2));

    const entity = await createEntity(entityType, data, userId);

    console.log(`✅ Successfully created ${entityType}!`);
    console.log('📦 Entity:', JSON.stringify(entity, null, 2));
    console.log(`🔗 View at: ${getEntityUrl(entityType, entity.id)}`);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

/**
 * Get entity URL for viewing
 */
function getEntityUrl(entityType: string, id: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const paths: Record<string, string> = {
    organization: `/organizations/${id}`,
    product: `/products/${id}`,
    service: `/services/${id}`,
    cause: `/causes/${id}`,
    loan: `/loans/${id}`,
    project: `/projects/${id}`,
    asset: `/assets/${id}`,
    ai_assistant: `/companions/${id}`,
  };
  return `${baseUrl}${paths[entityType] || `/${entityType}/${id}`}`;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { createEntity, createOrganization };
