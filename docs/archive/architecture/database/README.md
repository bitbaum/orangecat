# 🗄️ Database Architecture Documentation

**Overall Rating: 9.2/10** (2025 self-score) | **Status: Stale 2025-12-21 snapshot — not a current Production Ready claim** | **Simplified MVP Architecture**

> Last Updated: December 21, 2025 (stale; honesty pass 2026-09-03)
> Database: Supabase PostgreSQL
> Version: Production v2.0 (Simplified)
> Tables: 5 core tables (down from 10+)

## 📋 Quick Navigation

### 🚀 Getting Started

- **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - Essential commands & links (start here!)
- **[IMPROVEMENTS_SUMMARY.md](./IMPROVEMENTS_SUMMARY.md)** - What we built & how to deploy
- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Step-by-step deployment instructions

### Core Documentation

- **[Schema Overview](./schema-overview.md)** - High-level architecture and design patterns
- **[Analysis & Rating](./analysis-rating.md)** - Comprehensive 9.2/10 analysis of simplified architecture
- **[Current Schema](./database-schema.md)** - Complete database schema reference
- **[Migration Guide](./migrations-guide.md)** - Database migration instructions

### Current Tables (5 Core Tables)

- **[profiles](./tables/profiles.md)** - User profiles with Bitcoin features (15 essential fields)
- **[projects](./tables/projects.md)** - Unified fundraising entity (replaces campaigns + projects)
- **[transactions](./tables/transactions.md)** - Multi-entity Bitcoin payments (any → any)
- **[organizations](./tables/organizations.md)** - Group entities for collaborative fundraising
- **[organization_members](./tables/organization_members.md)** - Simple team management

### Key Features

- **Multi-Entity Transactions** - Any entity can donate to any other entity
- **Bitcoin Wallet Integration** - Lightning/Bitcoin addresses for all entities
- **Transparency by Default** - Public transaction visibility and audit trails
- **Simplified Permissions** - Clear role-based access control

### Database Benefits

- ✅ **60% Fewer Tables** - 5 core tables vs 10+ complex tables
- ✅ **Bitcoin-Native** - Lightning/Bitcoin addresses for all entities
- ✅ **Transparent** - Public transaction visibility and audit trails
- ✅ **Scalable** - Proper indexing and minimal JOINs
- ✅ **Maintainable** - Simple relationships and clear data flow

### Analysis & Roadmap

- **[Architecture Analysis & Rating](./analysis-rating.md)** - Comprehensive 9.2/10 analysis of simplified architecture
- **[Improvements Roadmap](./improvements-roadmap.md)** - Planned enhancements for current schema

## 🎯 Database at a Glance

### Statistics

- **5 Core Tables** - Essential entities for Bitcoin crowdfunding
- **Multi-Entity Transactions** - Any entity can donate to any other
- **Bitcoin Wallet Support** - Lightning/Bitcoin addresses for all entities
- **Row Level Security** - Comprehensive access control
- **2025 snapshot claimed production-ready** - do not treat as today's gate
- **3 Helper Functions** - Wallet balance and transaction history queries
- **15+ RLS Policies** - Comprehensive security coverage
- **15+ Indexes** - Strategic performance optimization
- **3 Custom ENUMs** - Type-safe status management

### Key Features

#### 1. Bitcoin-Native Architecture (9/10)

- ✅ Precise decimal handling: `numeric(20,8)` for satoshi precision
- ✅ Multiple payment methods: On-chain + Lightning Network
- ✅ Address validation with regex patterns
- ✅ Lightning addresses, node IDs, payment preferences
- ✅ Organization treasury management
- ✅ Revenue sharing via `reward_percentage`

#### 2. Polymorphic Associations (10/10)

- ✅ Flexible entity relationships in single table
- ✅ Temporal relationships (starts_at, ends_at)
- ✅ Version tracking for change history
- ✅ Multi-level visibility controls
- ✅ Complete audit trail

#### 3. Security First (8.5/10)

- ✅ RLS enabled on all tables
- ✅ Principle of least privilege
- ✅ Role-based access for organizations
- ✅ SECURITY DEFINER functions for controlled escalation

#### 4. Performance Optimized (8/10)

- ✅ GIN trigram indexes for fuzzy search
- ✅ Partial indexes for hot queries
- ✅ Denormalized counters with triggers
- ✅ Composite indexes for complex queries

## 🚀 Quick Start

### Accessing the Database

```bash
# Using Supabase CLI
supabase db pull

# Connect to production
psql $DATABASE_URL
```

### Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=https://supabase.orangecat.ch
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

### Common Queries

```sql
-- Get profile with associations
SELECT p.*,
  (SELECT COUNT(*) FROM follows WHERE following_id = p.id) as follower_count,
  (SELECT COUNT(*) FROM follows WHERE follower_id = p.id) as following_count
FROM profiles p
WHERE p.username = 'orangecat';

-- Get active projects
SELECT * FROM funding_pages
WHERE status = 'active'
ORDER BY created_at DESC;

-- Check transaction status
SELECT * FROM transactions
WHERE status IN ('pending', 'processing');
```

## 📊 Design Patterns Used

1. **Polymorphic Associations** - Flexible entity relationships
2. **Soft Deletes** - status = 'deleted' vs hard delete
3. **Denormalized Counters** - With trigger maintenance
4. **Temporal Data** - Time-bound relationships
5. **Version Tracking** - Association versioning
6. **Audit Trails** - created_by, last_modified_by
7. **JSONB for Extensibility** - Schema evolution
8. **Partial Indexing** - Performance + storage optimization
9. **Check Constraints** - Business rules at DB level
10. **Security Definer Functions** - Controlled privilege escalation

## ⚠️ Important Notes

### Current Limitations

- Transactions table not partitioned (will need this as volume grows)
- No dedicated audit log table (recommended for compliance)
- Missing index on `transactions.status` (being added)

### Planned Improvements

See [Improvements Roadmap](./improvements-roadmap.md) for:

- Table partitioning strategy
- Audit logging implementation
- Materialized views for analytics
- Archival strategy for old data

## 🔗 Related Documentation

- [Database Schema (Legacy)](../database-schema.md) - Original simplified docs
- [Association System Design](../association-system-masterpiece-design.md) - Deep dive into polymorphic associations
- [Supabase Schema Guide](../SUPABASE_SCHEMA_GUIDE.md) - Setup and migration guide
- [API Documentation](../../reference/api/README.md) - API endpoints using these tables

## 🛠️ Maintenance

### Regular Tasks

- **Weekly**: Review slow query logs
- **Monthly**: Check index usage statistics
- **Quarterly**: Analyze table bloat and vacuum
- **As needed**: Update RLS policies for new features

### Monitoring

```sql
-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
```

---

**Status**: Stale 2025-12-21 snapshot (not a current Production Ready claim) | **Rating**: 9.2/10 (then) | **Architecture**: Simplified MVP | **Last Updated**: December 21, 2025
