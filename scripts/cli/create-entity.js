#!/usr/bin/env node
/**
 * CLI Entity Creation Utility
 *
 * Allows creating any entity type (products, services, organizations, etc.)
 * from the command line. Works the same way as the OrangeCat GUI.
 *
 * Usage:
 *   node scripts/cli/create-entity.js --type organization --name "BitBaum AG" --description "Swiss Bitcoin company" --type company
 *   node scripts/cli/create-entity.js --type product --title "Coffee Mug" --price_sats 25000
 *
 * For organizations (companies):
 *   node scripts/cli/create-entity.js --type organization --name "My Company" --type company --governance_model hierarchical
 *
 * Created: 2025-12-27
 * Last Modified: 2025-12-27
 * Last Modified Summary: CLI utility for entity creation including organizations
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const AUTH_TOKEN = process.env.ORANGECAT_AUTH_TOKEN; // Optional: for authenticated requests

/**
 * Make HTTP request
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(AUTH_TOKEN && { Authorization: `Bearer ${AUTH_TOKEN}` }),
        ...options.headers,
      },
    };

    const req = client.request(requestOptions, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ status: res.statusCode, data: parsed });
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${parsed.error || data}`));
          }
        } catch (e) {
          reject(new Error(`Invalid JSON response: ${data}`));
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

/**
 * Generate slug from name
 */
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Create an entity via API
 */
async function createEntity(entityType, data) {
  const endpoint = `${API_BASE_URL}/api/${entityType === 'ai_assistant' ? 'ai-assistants' : entityType}s`;

  // Special handling for organizations
  if (entityType === 'organization') {
    // Ensure required fields
    if (!data.slug && data.name) {
      data.slug = generateSlug(data.name);
    }
    if (!data.type) {
      data.type = 'company'; // Default to company
    }
    if (!data.governance_model) {
      data.governance_model = 'hierarchical'; // Default governance
    }
  }

  console.log(`🚀 Creating ${entityType}...`);
  console.log(`📡 POST ${endpoint}`);
  console.log('📝 Data:', JSON.stringify(data, null, 2));

  try {
    const response = await makeRequest(endpoint, {
      method: 'POST',
      body: data,
    });

    console.log(`✅ Successfully created ${entityType}!`);
    console.log('📦 Response:', JSON.stringify(response.data, null, 2));

    // Print view URL
    if (response.data.organization || response.data.id) {
      const id = response.data.organization?.id || response.data.id || response.data.slug;
      const viewUrl = getEntityUrl(entityType, id);
      console.log(`🔗 View at: ${viewUrl}`);
    }

    return response.data;
  } catch (error) {
    console.error(`❌ Error creating ${entityType}:`, error.message);
    throw error;
  }
}

/**
 * Get entity URL for viewing
 */
function getEntityUrl(entityType, id) {
  const paths = {
    organization: `/organizations/${id}`,
    product: `/products/${id}`,
    service: `/services/${id}`,
    cause: `/causes/${id}`,
    loan: `/loans/${id}`,
    project: `/projects/${id}`,
    asset: `/assets/${id}`,
    ai_assistant: `/companions/${id}`,
    circle: `/circles/${id}`,
  };
  return `${API_BASE_URL}${paths[entityType] || `/${entityType}/${id}`}`;
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const data = {};
  let entityType = '';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--type' || arg === '-t') {
      entityType = args[++i];
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = args[++i];
      // Try to parse as number, boolean, or array
      if (value === 'true') data[key] = true;
      else if (value === 'false') data[key] = false;
      else if (!isNaN(Number(value)) && value !== '') data[key] = Number(value);
      else if (value.startsWith('[') && value.endsWith(']')) {
        // Array format: [item1,item2]
        data[key] = value
          .slice(1, -1)
          .split(',')
          .map(v => v.trim());
      } else data[key] = value;
    }
  }

  if (!entityType) {
    throw new Error('Entity type is required (--type or -t)');
  }

  return { entityType, data };
}

/**
 * Main CLI entry point
 */
async function main() {
  try {
    const { entityType, data } = parseArgs();

    if (Object.keys(data).length === 0) {
      console.error('❌ No data provided. Use --field value format.');
      console.error('\nExample:');
      console.error(
        '  node scripts/cli/create-entity.js --type organization --name "My Company" --type company'
      );
      process.exit(1);
    }

    await createEntity(entityType, data);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { createEntity, generateSlug };
