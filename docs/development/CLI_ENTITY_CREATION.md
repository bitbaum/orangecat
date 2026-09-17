---
created_date: 2025-12-27
last_modified_date: 2025-12-27
last_modified_summary: Documentation for CLI entity creation utility
---

# CLI Entity Creation

OrangeCat supports creating entities (products, services, organizations, etc.) from the command line, just like using the GUI.

## Quick Start

```bash
# Create an organization (company)
pnpm run create-entity --type organization --name "BitBaum AG" --description "Swiss Bitcoin company" --type company

# Create a product
pnpm run create-entity --type product --title "Coffee Mug" --price_sats 25000 --currency SATS

# Create a service
pnpm run create-entity --type service --title "Bitcoin Consulting" --category Consulting --hourly_rate_sats 50000
```

## Usage

```bash
pnpm run create-entity --type <entity_type> [--field value]...
```

### Entity Types

- `organization` - Organizations/companies (supports "create a profile of a company")
- `product` - Products
- `service` - Services
- `cause` - Charitable causes
- `loan` - Loan listings
- `project` - Crowdfunding projects
- `asset` - Assets
- `ai_assistant` - AI assistants
- `circle` - Circles

## Examples

### Creating an Organization (Company)

When you say "create a profile of a company", this is how it works:

```bash
pnpm run create-entity \
  --type organization \
  --name "My Company AG" \
  --description "A Bitcoin-focused company" \
  --type company \
  --governance_model hierarchical \
  --website_url https://example.com \
  --is_public true
```

**Required fields for organizations:**

- `name` - Organization name
- `type` - One of: dao, company, nonprofit, community, cooperative, foundation, collective, guild, syndicate, circle
- `governance_model` - One of: hierarchical, flat, democratic, consensus, liquid_democracy, quadratic_voting, stake_weighted, reputation_based

**Optional fields:**

- `description` - Organization description
- `slug` - URL slug (auto-generated from name if not provided)
- `website_url` - Company website
- `category` - Organization category
- `tags` - Array of tags (format: `[tag1,tag2]`)
- `treasury_address` - Bitcoin address for treasury
- `lightning_address` - Lightning address
- `is_public` - Public visibility (default: true)
- `requires_approval` - Require approval for members (default: true)

### Creating a Product

```bash
pnpm run create-entity \
  --type product \
  --title "Handmade Coffee Mug" \
  --description "Beautiful ceramic mug" \
  --price_sats 25000 \
  --currency SATS \
  --product_type physical \
  --category Handmade
```

### Creating a Service

```bash
pnpm run create-entity \
  --type service \
  --title "Bitcoin Consulting" \
  --description "Expert Bitcoin consulting services" \
  --category Consulting \
  --hourly_rate_sats 50000 \
  --service_location_type remote
```

### Creating a Cause

```bash
pnpm run create-entity \
  --type cause \
  --title "Education Scholarship Fund" \
  --description "Supporting students in need" \
  --cause_category Education \
  --goal_sats 5000000
```

## Authentication

By default, the CLI uses the API endpoint which requires authentication. You can:

1. **Set auth token** (if using service account):

   ```bash
   export ORANGECAT_AUTH_TOKEN="your-token"
   pnpm run create-entity --type organization --name "Test"
   ```

2. **Use the API directly** with your session cookie (for browser-based auth)

3. **Use the GUI** - The CLI works the same way as the OrangeCat web interface

## Programmatic Usage

You can also use the utility programmatically:

```javascript
const { createEntity } = require('./scripts/cli/create-entity');

// Create an organization
await createEntity('organization', {
  name: 'My Company',
  type: 'company',
  governance_model: 'hierarchical',
  description: 'A great company',
});
```

## Integration with AI Assistants

When an AI assistant (like Claude) is asked to "create a profile of a company", it can:

1. Parse the request to extract company details
2. Call the CLI utility or API directly
3. Create the organization with appropriate defaults
4. Return the created organization URL

Example AI interaction:

```
User: "Create a profile of a company called BitBaum AG, a Swiss Bitcoin company"

AI: [Calls createEntity('organization', {
  name: 'BitBaum AG',
  type: 'company',
  description: 'Swiss Bitcoin company',
  governance_model: 'hierarchical'
})]

AI: "✅ Created BitBaum AG! View at: https://orangecat.ch/organizations/bitbaum-ag"
```

## Notes

- All entity creation follows the same validation rules as the GUI
- Organizations automatically add the creator as a founder stakeholder
- The CLI uses the same API endpoints as the web interface
- Entity types and fields match the OrangeCat entity registry
