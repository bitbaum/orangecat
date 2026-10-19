# Database Migrations

created_date: 2024-03-24  
last_modified_date: 2025-11-27  
last_modified_summary: Documented profile contact_email field and schema extension pattern.

This directory contains SQL migration files that define the database schema and its evolution over time. Each migration file represents a specific change to the database structure.

## File Structure

- `20240324000000_combined_setup.sql`: The main migration file that sets up the initial database schema, including:
  - Enabling UUID extension
  - Creating tables (profiles, funding_pages, transactions)
  - Setting up Row Level Security (RLS) policies
  - Creating triggers and functions

## Migration Process

1. Each migration file is named with a timestamp prefix (YYYYMMDDHHMMSS) to ensure they are applied in the correct order.
2. Migrations are applied automatically on every deploy: `scripts/deploy-selfhost.sh` runs `scripts/apply-migrations.sh`, which applies pending files in filename order (each in one transaction) and records them in `public.schema_migrations`. Never apply one by hand.
3. Once a migration is applied, it should not be modified to maintain database consistency.

## Current Schema

The schema has evolved beyond the original three-table MVP, but the core entities remain:

1. **profiles**
   - Stores user profile information
   - Links to `auth.users` via `id`
   - Contains optional fields like `username`, `name`, `website`, `location_*`, transparency fields, and contact details
   - **Public contact email**: the `contact_email` column (added in `20251124060022_add_contact_email.sql`) is the public-facing email shown in the profile “Contact” section. It is separate from the private auth email.

2. **projects**
   - Stores crowdfunding project information
   - Links to profiles via `user_id`
   - Tracks project status, goals, current funding and uses a `metadata JSONB` column for flexible, project-specific data

3. **transactions**
   - Records donations and payments
   - Links to projects and users
   - Tracks transaction status and amounts

### Extending the profile schema safely

To add new pieces of profile data (for example, new fields in the “Info / Contact” section), follow this pattern:

1. **Create a migration** that adds a nullable column to `public.profiles` (e.g. `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS contact_email TEXT;`).
2. **Update TypeScript types** in `src/types/database.ts`, `src/types/profile.ts`, and any related social/contact types.
3. **Update validation and normalization** in `src/lib/validation/` (add the field to `profileSchema` and, if needed, to `normalizeProfileData`).
4. **Wire UI components** (e.g. `ModernProfileEditor`, `ProfileInfoTab`, `ProfileOverviewTab`) to read/write the new field.
5. **Document the new field** briefly in this guide (what it is used for, and whether it is public or private).

## Security

- Row Level Security (RLS) is enabled on all tables
- Policies are defined to control access based on user authentication
- Users can only access and modify their own data

## Usage

To apply migrations: add the file under `supabase/migrations/` and merge the PR.
The deploy applies it (see "Migration Process" above). `supabase db push` and the
retired managed-cloud project are not part of the workflow.

## Best Practices

1. Always create new migration files for schema changes
2. Never modify existing migration files
3. Test migrations in a development environment before applying to production
4. Keep migrations atomic and focused on a single change
5. Document any complex changes in the migration file comments
