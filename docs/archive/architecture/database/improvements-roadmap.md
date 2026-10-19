# 🚀 Database Improvements Roadmap

> Planned enhancements to take OrangeCat from 8.7/10 to 9.5/10

**Last Updated:** October 17, 2025
**Status:** In Progress

## Overview

Our database is **production-ready at 8.7/10**, but we've identified specific improvements to enhance scalability, observability, and performance. This document tracks implementation progress.

## Priority Matrix

```
High Impact, Quick Win  │  High Impact, Complex
────────────────────────┼──────────────────────────
• transactions.status   │  • Table Partitioning
  index ✅              │  • Materialized Views
• Audit Log Table      │
────────────────────────┼──────────────────────────
Low Impact, Quick Win   │  Low Impact, Complex
                        │
• Covering Indexes     │  • TimescaleDB
• Query Caching Docs   │  • Read Replicas
```

---

## 🔥 High Priority (0-1 Month)

### 1. Add Missing Index on transactions.status ✅ DONE

**Priority:** P0 - Critical
**Complexity:** Low (5 mins)
**Impact:** High (frequent filtering)

**Problem:**

```sql
-- This query is slow without index
SELECT * FROM transactions
WHERE status = 'pending'
ORDER BY created_at DESC;
```

**Solution:**

```sql
CREATE INDEX idx_transactions_status ON transactions(status);
```

**Expected improvement:**

- Query time: 500ms → 50ms (10x faster)
- Helps dashboard, admin tools, payment processing

**Status:** ✅ **COMPLETED** - Index created

---

### 2. Create Audit Logs Table

**Priority:** P0 - Critical (Compliance)
**Complexity:** Medium (2-3 hours)
**Impact:** High (Security, Compliance, Debugging)

**Why we need this:**

- Regulatory compliance (financial transactions)
- Security investigations (who did what, when)
- Debugging complex state changes
- User support (trace profile/payment issues)

**Design:**

```sql
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who
  user_id uuid REFERENCES profiles(id),
  session_id text,
  ip_address inet,
  user_agent text,

  -- What
  action text NOT NULL, -- 'create', 'update', 'delete', 'login', etc.
  table_name text NOT NULL,
  record_id uuid,

  -- Data
  old_data jsonb,  -- Previous state
  new_data jsonb,  -- New state
  changes jsonb,   -- Computed diff

  -- Context
  metadata jsonb DEFAULT '{}',

  -- When
  created_at timestamptz DEFAULT now(),

  -- Indexes
  INDEX idx_audit_user_time (user_id, created_at DESC),
  INDEX idx_audit_table_record (table_name, record_id),
  INDEX idx_audit_action (action, created_at DESC)
);

-- Retention policy (keep 1 year, then archive)
CREATE INDEX idx_audit_retention ON audit_logs(created_at)
WHERE created_at < NOW() - INTERVAL '1 year';
```

**What to log:**

- ✅ Profile updates (especially verification status)
- ✅ Financial transactions (all state changes)
- ✅ Organization membership changes
- ✅ Permission/role updates
- ✅ Campaign status changes
- ❌ Read operations (too noisy)
- ❌ Automated trigger updates (unless critical)

**Implementation:**

1. Create table migration
2. Add trigger function for auto-logging
3. Add manual logging to critical operations
4. Build admin UI to query logs
5. Set up archival job (monthly)

**Status:** 🔄 **IN PROGRESS**

---

## 📊 High Priority (1-3 Months)

### 3. Table Partitioning for Transactions

**Priority:** P1 - Important
**Complexity:** High (1 week)
**Impact:** High (Scalability)

**Problem:**
The `transactions` table will grow indefinitely:

- 1000 transactions/day = 365K/year
- 5 years = 1.8M rows
- Query performance degrades
- Vacuum/maintenance gets expensive

**Solution: Time-based partitioning**

```sql
-- Convert to partitioned table
CREATE TABLE transactions_partitioned (
  LIKE transactions INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE transactions_2025_10 PARTITION OF transactions_partitioned
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

CREATE TABLE transactions_2025_11 PARTITION OF transactions_partitioned
  FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

-- Attach existing data
-- (requires downtime OR pg_partman for zero-downtime)
```

**Benefits:**

- Query only relevant partitions (10x faster)
- Drop old partitions instantly (vs slow DELETE)
- Easier backups (partition-level)
- Better vacuum performance

**Migration strategy:**

1. **Phase 1:** Create partitioned table (empty)
2. **Phase 2:** Copy data in batches (off-peak)
3. **Phase 3:** Swap tables (minimal downtime)
4. **Phase 4:** Update app code (if needed)
5. **Phase 5:** Automate partition creation

**Automation:**

```sql
-- Monthly cron job
CREATE OR REPLACE FUNCTION create_next_partition()
RETURNS void AS $$
DECLARE
  partition_date date := date_trunc('month', NOW() + INTERVAL '1 month');
  partition_name text := 'transactions_' || to_char(partition_date, 'YYYY_MM');
  start_date text := partition_date::text;
  end_date text := (partition_date + INTERVAL '1 month')::text;
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF transactions_partitioned
     FOR VALUES FROM (%L) TO (%L)',
    partition_name, start_date, end_date
  );
END;
$$ LANGUAGE plpgsql;
```

**Status:** 📋 **PLANNED** - Q1 2026

---

### 4. Archival Strategy for Old Data

**Priority:** P1 - Important
**Complexity:** Medium (3-4 days)
**Impact:** Medium (Performance, Cost)

**Tables to archive:**

#### notifications (archive after 90 days)

```sql
CREATE TABLE notifications_archive (
  LIKE notifications INCLUDING ALL
);

-- Monthly archival job
INSERT INTO notifications_archive
SELECT * FROM notifications
WHERE created_at < NOW() - INTERVAL '90 days'
  AND is_read = true;

DELETE FROM notifications
WHERE id IN (SELECT id FROM notifications_archive);
```

#### audit_logs (archive after 1 year)

```sql
CREATE TABLE audit_logs_archive_2024 (
  LIKE audit_logs INCLUDING ALL
);

-- Yearly archival
INSERT INTO audit_logs_archive_2024
SELECT * FROM audit_logs
WHERE created_at >= '2024-01-01'
  AND created_at < '2025-01-01';
```

**Benefits:**

- Smaller active tables (faster queries)
- Lower storage costs (compress archives)
- Maintain history (compliance)

**Archive storage options:**

1. **Same DB, different schema** - Easy, same queries
2. **S3 + Parquet** - Cheap, queryable with Athena
3. **Data warehouse** - Snowflake/BigQuery for analytics

**Status:** 📋 **PLANNED** - Q2 2026

---

## 🚀 Medium Priority (3-6 Months)

### 5. Materialized Views for Analytics

**Priority:** P2 - Nice to have
**Complexity:** Medium (1 week)
**Impact:** Medium (Performance)

**Use cases:**

#### Campaign Leaderboard

```sql
CREATE MATERIALIZED VIEW project_leaderboard AS
SELECT
  fp.id,
  fp.title,
  fp.slug,
  fp.current_amount,
  fp.goal_amount,
  fp.current_amount / NULLIF(fp.goal_amount, 0) * 100 as progress_pct,
  COUNT(DISTINCT t.id) as donor_count,
  COUNT(DISTINCT t.user_id) as unique_donors,
  MAX(t.created_at) as last_donation_at
FROM funding_pages fp
LEFT JOIN transactions t ON t.funding_page_id = fp.id
WHERE fp.status = 'active'
GROUP BY fp.id
ORDER BY fp.current_amount DESC;

-- Refresh hourly
CREATE INDEX ON project_leaderboard(current_amount DESC);
```

#### User Contribution Stats

```sql
CREATE MATERIALIZED VIEW user_contribution_stats AS
SELECT
  p.id,
  p.username,
  COUNT(DISTINCT t.funding_page_id) as projects_supported,
  SUM(t.amount) as total_donated,
  AVG(t.amount) as avg_donation,
  MIN(t.created_at) as first_donation_at,
  MAX(t.created_at) as last_donation_at
FROM profiles p
LEFT JOIN transactions t ON t.user_id = p.id
WHERE t.status = 'completed'
GROUP BY p.id;
```

**Refresh strategy:**

- **Real-time views**: Refresh on every write (slow)
- **Near real-time**: Refresh every 5-15 minutes
- **Batch**: Refresh nightly (2am)

**Implementation:**

```sql
-- Option 1: Manual refresh
REFRESH MATERIALIZED VIEW CONCURRENTLY project_leaderboard;

-- Option 2: Automated (pg_cron)
SELECT cron.schedule('refresh-leaderboard', '*/15 * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY project_leaderboard');
```

**Status:** 📋 **PLANNED** - Q2 2026

---

### 6. Covering Indexes

**Priority:** P2 - Nice to have
**Complexity:** Low (2-3 hours)
**Impact:** Low-Medium (Performance)

**What are covering indexes?**
Include all columns needed by query → no table lookup needed

**Example:**

```sql
-- Current: Index only on username
CREATE INDEX idx_profiles_username ON profiles(username);

-- Query needs username + name + avatar_url
SELECT username, name, avatar_url
FROM profiles
WHERE username = 'orangecat';

-- Problem: Index lookup + table lookup (2 I/O operations)

-- Solution: Covering index
CREATE INDEX idx_profiles_username_covering ON profiles(username)
INCLUDE (name, avatar_url);

-- Now: Index-only scan (1 I/O operation) ✅
```

**Candidates:**

1. Profile search: `username INCLUDE (name, avatar_url, is_verified)`
2. Campaign list: `status INCLUDE (title, slug, current_amount, goal_amount)`
3. Notifications: `user_id, is_read INCLUDE (type, title, created_at)`

**Trade-off:**

- ✅ Faster reads (index-only scans)
- ❌ Slower writes (larger index to maintain)
- ❌ More storage (duplicated data)

**When to use:**

- ✅ Read-heavy tables
- ✅ Hot queries with limited columns
- ❌ Wide tables (many columns)
- ❌ Frequently updated columns

**Status:** 📋 **PLANNED** - Q3 2026

---

## 🔮 Future Considerations (6+ Months)

### 7. Read Replicas

**When needed:** > 10K users, heavy analytics load

```
Primary (Write) ──→ Replica 1 (Analytics)
                ──→ Replica 2 (Dashboard)
                ──→ Replica 3 (Backups)
```

**Use cases:**

- Analytics queries don't impact production
- Geo-distributed reads (lower latency)
- Zero-downtime migrations

**Supabase setup:**

- Supabase Pro: Read replicas available
- Configure in dashboard
- Update connection strings

---

### 8. TimescaleDB Extension

**When needed:** Heavy time-series analytics

**Benefits:**

- Automatic partitioning (time-based)
- Compression (10x storage savings)
- Continuous aggregates (faster queries)

**Ideal for:**

- Bitcoin price history
- Transaction volume tracking
- User activity patterns

```sql
-- Convert transactions to hypertable
SELECT create_hypertable('transactions', 'created_at');

-- Automatic compression
ALTER TABLE transactions SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'user_id'
);
```

---

### 9. Connection Pooling (PgBouncer)

**When needed:** > 100 concurrent users

**Why:**

- PostgreSQL has max connections limit
- Each connection has overhead
- Pooler reuses connections

**Setup:**

```bash
# Supabase provides PgBouncer
# Use pooled connection string for:
- Serverless functions
- High-concurrency APIs
- Background jobs
```

---

## 📈 Success Metrics

### Performance

- ✅ 95th percentile query time < 100ms
- ✅ Dashboard loads in < 1s
- ✅ Search response < 200ms

### Scalability

- ✅ Handle 10K concurrent users
- ✅ 100K transactions/day
- ✅ 1M+ profiles

### Observability

- ✅ All critical operations logged
- ✅ Slow queries identified
- ✅ Index usage monitored

---

## Implementation Timeline

```
Month 1 (Oct 2025)
├── ✅ transactions.status index
├── 🔄 Audit logs table
└── 📄 Documentation

Month 2-3 (Nov-Dec 2025)
├── Table partitioning (transactions)
└── Archival strategy (notifications)

Month 4-6 (Q1 2026)
├── Materialized views
├── Covering indexes
└── Performance testing

Month 7-12 (Q2-Q3 2026)
├── Read replicas (if needed)
├── TimescaleDB evaluation
└── Advanced analytics
```

---

## How to Contribute

### Adding New Improvements

1. Identify the problem
2. Quantify impact (query times, storage)
3. Design solution with trade-offs
4. Create migration script
5. Test on staging
6. Document in this roadmap

### Testing Strategy

```sql
-- Before
EXPLAIN ANALYZE
SELECT * FROM transactions WHERE status = 'pending';

-- After
EXPLAIN ANALYZE
SELECT * FROM transactions WHERE status = 'pending';

-- Compare: Execution time, rows scanned, index used
```

---

**Next:** Let's start implementing!
See [Implementation Guide](./implementation-guide.md) for step-by-step instructions.
