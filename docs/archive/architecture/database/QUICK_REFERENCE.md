# 🚀 Database Quick Reference

> Essential commands and links at your fingertips

**Last Updated:** October 17, 2025

---

## 📊 Quick Stats

- **Rating:** 8.7/10 ⭐⭐⭐⭐⭐
- **Tables:** 10
- **Functions:** 6
- **RLS Policies:** 24
- **Indexes:** 20+
- **Status:** Production Ready ✅

---

## 🔗 Essential Links

> (Managed Supabase Cloud retired 2026-06 — DB is now self-hosted at supabase.orangecat.ch on the Hetzner box; Studio / SQL editor / logs are accessed via the box / founder.)

| Resource              | URL                                 |
| --------------------- | ----------------------------------- |
| **Supabase Studio**   | self-hosted (via the box / founder) |
| **SQL Editor**        | self-hosted Studio                  |
| **Database Explorer** | self-hosted Studio                  |
| **Logs**              | self-hosted Studio                  |
| **Indexes**           | self-hosted Studio                  |

---

## 📁 Documentation Navigation

| Document                                                 | Purpose                        |
| -------------------------------------------------------- | ------------------------------ |
| **[README.md](./README.md)**                             | Start here - navigation hub    |
| **[schema-overview.md](./schema-overview.md)**           | Architecture & design patterns |
| **[analysis-rating.md](./analysis-rating.md)**           | Comprehensive 8.7/10 analysis  |
| **[improvements-roadmap.md](./improvements-roadmap.md)** | Planned enhancements           |
| **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)**         | How to apply migrations        |
| **[IMPROVEMENTS_SUMMARY.md](./IMPROVEMENTS_SUMMARY.md)** | What we built today            |

---

## ⚡ Common Commands

### Check Table Sizes

```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Check Index Usage

```sql
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as times_used,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
```

### Find Slow Queries

```sql
SELECT
  pid,
  now() - pg_stat_activity.query_start AS duration,
  query,
  state
FROM pg_stat_activity
WHERE state != 'idle'
  AND now() - pg_stat_activity.query_start > interval '5 seconds'
ORDER BY duration DESC;
```

### Check Active Connections

```sql
SELECT
  count(*) as total_connections,
  count(*) FILTER (WHERE state = 'active') as active,
  count(*) FILTER (WHERE state = 'idle') as idle
FROM pg_stat_activity;
```

### View Recent Audit Logs (After Migration #2)

```sql
SELECT
  created_at,
  action,
  table_name,
  user_id,
  severity
FROM audit_logs
ORDER BY created_at DESC
LIMIT 20;
```

---

## 🎯 Pending Migrations

### ✅ Ready to Apply

#### 1. Add transactions.status Index

```bash
File: supabase/migrations/20251017000001_add_transactions_status_index.sql
Priority: P0 - Critical
Impact: 10x faster transaction queries
Risk: Low
Time: 2 minutes
```

**Quick Apply (Supabase Dashboard):**

```sql
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
```

#### 2. Create Audit Logs Table

```bash
File: supabase/migrations/20251017000002_create_audit_logs.sql
Priority: P0 - Compliance
Impact: Security, debugging, compliance
Risk: Low
Time: 5 minutes
```

**Apply:** Copy entire file content to SQL Editor

---

## 🔍 Verification Queries

### After Migration #1 (Index)

```sql
-- Verify index exists
SELECT * FROM pg_indexes
WHERE indexname = 'idx_transactions_status';

-- Test index is used
EXPLAIN ANALYZE
SELECT * FROM transactions
WHERE status = 'pending'
LIMIT 10;
-- Look for: "Index Scan using idx_transactions_status"
```

### After Migration #2 (Audit Logs)

```sql
-- Verify table exists
SELECT count(*) FROM audit_logs;

-- Verify function exists
SELECT proname FROM pg_proc WHERE proname = 'create_audit_log';

-- Test audit logging
UPDATE profiles SET bio = 'Test' WHERE id = auth.uid();
SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 1;
```

---

## 📊 Monitoring Queries

### Index Health

```sql
SELECT
  indexname,
  idx_scan as times_used,
  idx_tup_read as rows_read,
  idx_tup_fetch as rows_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

### Table Bloat

```sql
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) -
                 pg_relation_size(schemaname||'.'||tablename)) as indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Audit Log Volume (After Migration #2)

```sql
SELECT
  date_trunc('day', created_at) as day,
  count(*) as logs_created,
  count(*) FILTER (WHERE severity = 'critical') as critical_count
FROM audit_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY day
ORDER BY day DESC;
```

---

## 🛠️ Useful Functions

### Create Manual Audit Log (After Migration #2)

```sql
SELECT create_audit_log(
  p_user_id := auth.uid(),
  p_action := 'update',
  p_table_name := 'your_table',
  p_record_id := 'record-uuid',
  p_metadata := '{"reason": "manual change"}'::jsonb,
  p_severity := 'info'
);
```

### Increment Profile Views

```sql
SELECT increment_profile_views('profile-uuid');
```

### Update Follow Counts (Automatic via Trigger)

```sql
-- Automatically maintained when follows are added/removed
INSERT INTO follows (follower_id, following_id)
VALUES ('user-a-id', 'user-b-id');
```

---

## 🚨 Troubleshooting

### Connection Issues

```sql
-- Check if you can connect
SELECT current_database(), current_user, version();
```

### Permission Issues

```sql
-- Check your role
SELECT current_user, session_user;

-- Check RLS status
SELECT
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public';
```

### Migration Failed

```sql
-- Check what migrations were applied
SELECT * FROM supabase_migrations.schema_migrations
ORDER BY version DESC;

-- Rollback transaction (if still open)
ROLLBACK;
```

---

## 📈 Performance Baselines

### Current (Before Improvements)

```
transactions table:
- Status filter query: ~500ms (seq scan)
- No audit trail
```

### Target (After Improvements)

```
transactions table:
- Status filter query: ~50ms (index scan) ✨ 10x faster
- Complete audit trail ✅
- Compliance ready ✅
```

---

## 🎯 Quick Deployment Checklist

Before applying any migration:

- [ ] Read migration file
- [ ] Understand what it does
- [ ] Check if it's idempotent (IF NOT EXISTS)
- [ ] Have rollback plan ready
- [ ] Test in staging (if available)
- [ ] Apply during low traffic
- [ ] Verify after applying
- [ ] Monitor for 24 hours

---

## 📞 Emergency Contacts

### Supabase Support

- Status Page: https://status.supabase.com/
- Support: Dashboard → Help → Support
- Community: https://github.com/supabase/supabase/discussions

### Rollback Procedures

#### Rollback Index Creation

```sql
BEGIN;
DROP INDEX IF EXISTS idx_transactions_status;
COMMIT;
```

#### Rollback Audit Logs (if needed)

```sql
BEGIN;
DROP TRIGGER IF EXISTS trigger_audit_profile_changes ON profiles;
DROP FUNCTION IF EXISTS audit_profile_changes();
DROP FUNCTION IF EXISTS create_audit_log(uuid, text, text, uuid, jsonb, jsonb, jsonb, text);
DROP TABLE IF EXISTS audit_logs;
COMMIT;
```

---

## 🎓 Learning Resources

### PostgreSQL

- Official Docs: https://www.postgresql.org/docs/
- Performance Tips: https://wiki.postgresql.org/wiki/Performance_Optimization
- Index Types: https://www.postgresql.org/docs/current/indexes-types.html

### Supabase

- Docs: https://supabase.com/docs
- RLS Guide: https://supabase.com/docs/guides/auth/row-level-security
- Migrations: https://supabase.com/docs/guides/cli/local-development#database-migrations

---

## 💡 Pro Tips

1. **Always wrap in transactions**

   ```sql
   BEGIN;
   -- your changes
   COMMIT;  -- or ROLLBACK if something wrong
   ```

2. **Use EXPLAIN ANALYZE**

   ```sql
   EXPLAIN ANALYZE SELECT ...
   ```

3. **Check execution plans**
   - Look for "Seq Scan" (bad for large tables)
   - Look for "Index Scan" (good!)
   - Look for execution time

4. **Monitor index usage**
   - Unused indexes waste space and slow writes
   - Check pg_stat_user_indexes regularly

5. **Keep audit logs trimmed**
   - Archive old logs (>1 year)
   - Vacuum regularly
   - Monitor table size

---

**Last Updated:** October 17, 2025
**Version:** 1.0
**Status:** Ready for deployment! 🚀
