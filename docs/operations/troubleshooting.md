# 🔧 OrangeCat Troubleshooting Guide

**Comprehensive guide to diagnosing and resolving issues in the OrangeCat platform.**

## 🎯 Troubleshooting Philosophy

**"Problems are opportunities to improve"** - Every issue we solve makes the system more robust and our team more knowledgeable.

## 🔍 Systematic Troubleshooting Approach

### **1. Gather Information**

- **Reproduce the issue** - Can you make it happen consistently?
- **Document symptoms** - What exactly is happening vs. what should happen?
- **Collect context** - When did it start? What changed recently?

### **2. Form Hypotheses**

- **Identify possible causes** - List likely root causes
- **Prioritize by probability** - Start with most likely issues
- **Consider impact** - Focus on issues affecting users first

### **3. Test & Verify**

- **Test hypothesis** - Implement the fix or workaround
- **Verify resolution** - Confirm the issue is resolved
- **Check for side effects** - Ensure fix doesn't break other functionality

### **4. Document & Prevent**

- **Document the solution** - Help future troubleshooting
- **Implement prevention** - Prevent the issue from recurring
- **Share learnings** - Improve team knowledge

## 🚨 Common Issue Categories

### **🔐 Authentication Issues**

**Symptoms:** Users can't log in, sessions expire unexpectedly, auth redirects fail

**Common Causes:**

- Environment variables not set correctly
- Supabase configuration issues
- RLS policies too restrictive
- JWT token expiration or corruption

**Debugging Steps:**

```bash
# Check environment variables
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY

# Test Supabase connection
supabase status

# Check auth logs
supabase logs --db-url
```

**Solutions:**

- Verify all required environment variables are set
- Check Supabase dashboard for auth configuration
- Review RLS policies in Supabase
- Clear browser cookies and localStorage

### **🗄️ Database Issues**

**Symptoms:** Queries slow, connection failures, data not persisting

**Common Causes:**

- Missing database indexes
- Large table scans
- Connection pool exhaustion
- Incorrect query patterns

**Debugging Steps:**

```sql
-- Check slow queries
SELECT * FROM pg_stat_statements
ORDER BY mean_time DESC LIMIT 10;

-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public';

-- Check for missing indexes
SELECT * FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename;
```

**Solutions:**

- Add missing indexes for common query patterns
- Optimize queries to use indexes
- Check connection pool configuration
- Review query patterns in code

### **⚡ Performance Issues**

**Symptoms:** Slow page loads, high memory usage, API timeouts

**Common Causes:**

- Large bundle sizes
- Inefficient database queries
- Memory leaks in components
- Missing caching

**Debugging Steps:**

```bash
# Check bundle size
pnpm run analyze

# Profile React components
# Use React DevTools Profiler

# Monitor memory usage
# Check browser DevTools Memory tab
```

**Solutions:**

- Implement code splitting for large components
- Add database indexes for slow queries
- Fix memory leaks with proper cleanup
- Implement caching for frequently accessed data

### **🚀 Deployment Issues**

**Symptoms:** Build failures, deployment errors, runtime crashes

**Common Causes:**

- Environment variable mismatches
- Build configuration errors
- Dependency conflicts
- Platform-specific issues

**Debugging Steps:**

```bash
# Check build locally
pnpm run build

# Verify environment variables
pnpm run env:validate

# Check deployment logs (on the Hetzner box)
# Tail the app process logs / Caddy logs on bitbaum
```

**Solutions:**

- Ensure all environment variables are properly set
- Check build configuration for environment-specific settings
- Resolve dependency conflicts
- Test deployment on staging before production

## 🛠️ Issue-Specific Solutions

### **Port Conflicts**

**Problem:** "Port 3003 is already in use"

```bash
# Kill existing processes
pnpm run kill:node

# Or find and kill manually
lsof -ti:3003 | xargs kill -9

# Start fresh
pnpm run fresh:start
```

### **Database Connection Issues**

**Problem:** Supabase connection failures

```bash
# Check Supabase status
supabase status

# Restart local Supabase
supabase stop && supabase start

# Verify connection in code
# Check .env.local file
```

### **Build Failures**

**Problem:** Next.js build errors

```bash
# Clear cache and rebuild
pnpm run clear:cache
pnpm run build

# Check for TypeScript errors
pnpm run type-check

# Check for linting issues
pnpm run lint
```

### **Test Failures**

**Problem:** Tests not passing

```bash
# Run tests with verbose output
pnpm test --reporter=verbose

# Check test environment
pnpm test tests/env.test.ts

# Run specific failing test
pnpm test -t "failing test name"
```

### **Memory Leaks**

**Problem:** App slowing down over time

```typescript
// Check for proper cleanup in useEffect
useEffect(() => {
  const handleResize = () => {};
  window.addEventListener('resize', handleResize);

  return () => {
    window.removeEventListener('resize', handleResize); // ✅ Proper cleanup
  };
}, []);
```

## 📊 Monitoring & Alerting

### **Application Health Checks**

```bash
# Check application health
pnpm run health:check

# Monitor real-time metrics
pnpm run monitor:metrics

# Check database connectivity
supabase status
```

### **Error Monitoring Setup**

```typescript
// Production error tracking
import * as Sentry from '@sentry/nextjs';

try {
  // Your code
} catch (error) {
  Sentry.captureException(error, {
    tags: { component: 'UserProfile' },
    user: { id: userId },
    extra: { action: 'updateProfile' },
  });
}
```

### **Performance Monitoring**

```typescript
// Track performance metrics
import { performanceMonitor } from '@/services/monitoring';

export async function trackApiPerformance(endpoint: string, duration: number) {
  performanceMonitor.recordMetric('api_response_time', duration, {
    endpoint,
    method: 'GET',
  });
}
```

## 🔧 Development Environment Issues

### **VS Code Issues**

**Problem:** Extensions not working, IntelliSense broken

**Solutions:**

- Reload VS Code window (`Ctrl+Shift+P` → "Developer: Reload Window")
- Clear VS Code cache and restart
- Reinstall problematic extensions

### **Node.js Issues**

**Problem:** Node version conflicts, module resolution errors

**Solutions:**

- Use nvm to manage Node versions: `nvm use 18`
- Clear npm cache: `npm cache clean --force`
- Delete node_modules and reinstall: `rm -rf node_modules && pnpm install`

### **Git Issues**

**Problem:** Merge conflicts, lost commits, repository corruption

**Solutions:**

- For merge conflicts: Use `git mergetool` or resolve manually
- For lost commits: Check `git reflog`
- For repository issues: `git gc --aggressive`

## 🆘 Escalation Procedures

### **When to Escalate**

- **Critical issues** affecting production users
- **Security vulnerabilities** or data breaches
- **Persistent issues** that can't be resolved locally
- **Infrastructure problems** requiring DevOps intervention

### **Escalation Path**

1. **Self-debug** using this guide (15-30 minutes)
2. **Team chat** - #dev-orangecat for collaborative debugging
3. **Technical lead** for architectural or complex issues
4. **DevOps team** for infrastructure or deployment issues
5. **Emergency on-call** for critical production issues

### **Emergency Contacts**

- **Production Issues**: Check deployment documentation
- **Security Incidents**: Follow security incident response plan
- **Data Loss**: Contact technical lead immediately

## 📚 Documentation References

### **Quick Reference**

- **[Development Setup](../development/SETUP.md)** - Environment configuration
- **[Debugging Guide](../development/debugging.md)** - Development debugging
- **[Performance Guide](../development/performance-debugging.md)** - Performance optimization
- **[Error Handling](../development/error-handling.md)** - Error management
- **[Monitoring Guide](../operations/monitoring.md)** - Production monitoring

### **External Resources**

- **[Next.js Troubleshooting](https://nextjs.org/docs/advanced-features/debugging)** - Framework-specific issues
- **[Supabase Troubleshooting](https://supabase.com/docs/guides/troubleshooting)** - Database issues
  - Note: our DB is **self-hosted** (`supabase.orangecat.ch` on the Hetzner box) — for DB issues, check logs on the box; external Supabase Cloud docs may not apply.
- **[React DevTools](https://react.dev/learn/react-developer-tools)** - Component debugging

## 🛡️ Prevention Strategies

### **Proactive Monitoring**

- Set up automated health checks
- Monitor error rates and performance metrics
- Regular security audits and dependency updates

### **Code Quality Gates**

- Pre-commit hooks for linting and tests
- Pre-deployment validation
- Automated code review requirements

### **Documentation Maintenance**

- Keep troubleshooting guides current
- Document solutions to recurring issues
- Share learnings across the team

## 📝 Issue Documentation

### **Bug Report Template**

```markdown
## Issue Description

[Clear description of the problem]

## Steps to Reproduce

1. [Step 1]
2. [Step 2]
3. [Step 3]

## Expected Behavior

[What should happen]

## Actual Behavior

[What actually happens]

## Environment

- Browser: [Chrome/Firefox/Safari]
- Environment: [Development/Staging/Production]
- Version: [Current version]

## Additional Context

[Logs, screenshots, error messages]
```

### **Root Cause Analysis**

- **What caused the issue?**
- **Why wasn't it caught earlier?**
- **How can we prevent it in the future?**
- **What monitoring should we add?**

---

**Last Updated:** 2026-06-15
**Troubleshooting Philosophy:** "Every problem solved makes us stronger - document the solution and prevent recurrence"
