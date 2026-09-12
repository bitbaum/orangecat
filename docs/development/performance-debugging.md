# ⚡ OrangeCat Performance Debugging Guide

**Comprehensive guide to debugging and optimizing OrangeCat performance across all layers.**

## 🎯 Performance Philosophy

**"Performance is a feature"** - Every user interaction should feel instant and responsive.

## 📊 Performance Metrics

### Core Web Vitals (Target Values)

| Metric  | Target  | Description                                |
| ------- | ------- | ------------------------------------------ |
| **LCP** | < 2.5s  | Largest Contentful Paint - loading speed   |
| **FID** | < 100ms | First Input Delay - interactivity          |
| **CLS** | < 0.1   | Cumulative Layout Shift - visual stability |

### Application-Specific Metrics

| Metric             | Target  | Description            |
| ------------------ | ------- | ---------------------- |
| **Page Load**      | < 1s    | Time to interactive    |
| **API Response**   | < 200ms | Backend response time  |
| **Database Query** | < 50ms  | Query execution time   |
| **Bundle Size**    | < 500KB | JavaScript bundle size |

## 🔍 Performance Investigation Tools

### Browser DevTools

#### Performance Tab

```javascript
// Record performance profile
// 1. Open DevTools → Performance tab
// 2. Click "Record"
// 3. Perform user actions
// 4. Click "Stop"
// 5. Analyze the timeline
```

#### Network Tab

- Monitor API request/response times
- Check for slow resources
- Identify caching opportunities

#### Lighthouse

```bash
# Run Lighthouse audit
pnpm dlx lighthouse http://localhost:3003 \
  --output html \
  --output-path ./lighthouse-report.html
```

### React DevTools Profiler

```tsx
import { Profiler } from 'react';

function onRenderCallback(id, phase, actualDuration, baseDuration, startTime, commitTime) {
  console.log('Component render:', {
    id,
    phase,
    actualDuration,
    baseDuration,
  });
}

// Wrap components to profile
<Profiler id="ExpensiveComponent" onRender={onRenderCallback}>
  <ExpensiveComponent />
</Profiler>;
```

### Database Performance

#### Query Analysis

```sql
-- Enable query timing
\timing on

-- Analyze slow queries
SELECT * FROM pg_stat_statements
ORDER BY mean_time DESC LIMIT 10;

-- Check table statistics
SELECT
  schemaname,
  tablename,
  n_tup_ins,
  n_tup_upd,
  n_tup_del
FROM pg_stat_user_tables;
```

#### Supabase Performance

```typescript
// Monitor Supabase queries
import { supabase } from '@/services/supabase/client';

// Enable query logging
supabase
  .from('table')
  .select('*')
  .then(result => {
    console.log('Query time:', Date.now() - startTime);
  });
```

## 🚀 Performance Optimization Techniques

### Frontend Optimization

#### Code Splitting

```typescript
// Dynamic imports for route-based splitting
const Dashboard = lazy(() => import('./Dashboard'));

// Component-based splitting
const ExpensiveChart = lazy(() => import('./ExpensiveChart'));
```

#### Image Optimization

```tsx
import Image from 'next/image';

// Optimized images
<Image
  src="/hero-image.jpg"
  alt="Hero"
  width={800}
  height={600}
  priority // Preload critical images
/>;
```

#### Bundle Analysis

```bash
# Analyze bundle size
pnpm run analyze

# Check for large dependencies
pnpm run bundle:check
```

### Backend Optimization

#### Database Indexing

```sql
-- Add performance indexes
CREATE INDEX idx_projects_active_created
ON projects(created_at DESC)
WHERE status = 'active';

-- Composite indexes for common queries
CREATE INDEX idx_projects_user_status
ON projects(user_id, status, created_at DESC);
```

#### Query Optimization

```typescript
// Use specific columns instead of SELECT *
const { data } = await supabase
  .from('projects')
  .select('id, title, status') // Only needed columns
  .eq('status', 'active')
  .limit(20);
```

#### Caching Strategy

```typescript
// Implement intelligent caching
const cache = new Map();

function getCachedData(key, fetcher, ttl = 5 * 60 * 1000) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }

  const data = await fetcher();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
}
```

### API Optimization

#### Response Compression

```typescript
// Enable gzip compression in Next.js
// next.config.js
const nextConfig = {
  compress: true,
  // ...
};
```

#### API Route Optimization

```typescript
// Cache API responses
export async function GET(request: NextRequest) {
  const cacheKey = 'api-data';

  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached) return Response.json(cached);

  // Fetch fresh data
  const data = await fetchData();
  cache.set(cacheKey, data);

  return Response.json(data);
}
```

## 📈 Performance Monitoring

### Real-time Monitoring

```typescript
// Custom performance monitoring
import { performanceMonitor } from '@/services/monitoring';

export async function trackApiPerformance(endpoint: string, duration: number) {
  performanceMonitor.recordMetric('api_response_time', duration, {
    endpoint,
    method: 'GET',
  });
}
```

### Performance Budgets

```typescript
// Set performance budgets
const PERFORMANCE_BUDGETS = {
  bundleSize: 500 * 1024, // 500KB
  firstContentfulPaint: 1800, // 1.8s
  largestContentfulPaint: 2500, // 2.5s
  firstInputDelay: 100, // 100ms
  cumulativeLayoutShift: 0.1,
};
```

### Automated Performance Testing

```typescript
// Performance regression tests
test('should not regress performance', async ({ page }) => {
  const startTime = Date.now();
  await page.goto('/dashboard');
  const loadTime = Date.now() - startTime;

  expect(loadTime).toBeLessThan(2000); // 2s budget
});
```

## 🐛 Common Performance Issues

### Large Bundle Size

**Symptoms:** Slow initial load, high memory usage

**Solutions:**

```bash
# Check bundle size
pnpm run analyze

# Split large components
# Use dynamic imports
const HeavyComponent = lazy(() => import('./HeavyComponent'));

# Tree shaking
# Remove unused imports
```

### Slow Database Queries

**Symptoms:** API endpoints taking >200ms

**Solutions:**

```sql
-- Add missing indexes
CREATE INDEX idx_projects_status_created
ON projects(status, created_at DESC);

-- Optimize query patterns
SELECT id, title FROM projects WHERE status = 'active' ORDER BY created_at DESC;
```

### Inefficient Re-renders

**Symptoms:** Choppy animations, slow interactions

**Solutions:**

```typescript
// Use React.memo for expensive components
const ExpensiveComponent = memo(({ data }) => {
  return <div>{data.title}</div>;
});

// Use useMemo for expensive calculations
const processedData = useMemo(() => {
  return data.filter(item => item.active);
}, [data]);

// Use useCallback for event handlers
const handleClick = useCallback(() => {
  doSomething();
}, []);
```

### Memory Leaks

**Symptoms:** App slowing down over time, high memory usage

**Solutions:**

```typescript
// Clean up event listeners
useEffect(() => {
  const handleResize = () => {};
  window.addEventListener('resize', handleResize);

  return () => {
    window.removeEventListener('resize', handleResize);
  };
}, []);

// Monitor memory usage
if (typeof window !== 'undefined') {
  console.log('Memory usage:', performance.memory);
}
```

## 🚨 Performance Alerting

### Automated Alerts

```typescript
// Performance monitoring service
const alertThresholds = {
  responseTime: 1000, // 1s
  errorRate: 0.05, // 5%
  memoryUsage: 100 * 1024 * 1024, // 100MB
};

function checkPerformance() {
  const metrics = performanceMonitor.getMetrics();

  if (metrics.averageResponseTime > alertThresholds.responseTime) {
    alert('Slow response times detected');
  }
}
```

### Performance Dashboards

```bash
# Start performance monitoring
pnpm run performance:check

# View real-time metrics
open http://localhost:3003/monitoring
```

## 📊 Performance Benchmarks

### Baseline Measurements

```typescript
// Document baseline performance
const BASELINE_METRICS = {
  homepageLoadTime: 1200, // 1.2s
  dashboardLoadTime: 800, // 0.8s
  apiResponseTime: 150, // 150ms
  bundleSize: 450 * 1024, // 450KB
  lighthouseScore: 95, // 95/100
};
```

### Regression Testing

```typescript
test('should not regress performance', async ({ page }) => {
  const baseline = await getBaselineMetrics();
  const current = await measureCurrentMetrics(page);

  // Alert on significant regressions
  Object.keys(baseline).forEach(metric => {
    const regression = (current[metric] - baseline[metric]) / baseline[metric];
    if (regression > 0.1) {
      // 10% regression
      throw new Error(`Performance regression in ${metric}: ${regression * 100}%`);
    }
  });
});
```

## 🔧 Performance Tools Setup

### Chrome DevTools Setup

1. **Install React DevTools** - Browser extension
2. **Enable Performance recording** - DevTools settings
3. **Set up workspace** - Map to local files

### VS Code Performance Extensions

```json
// .vscode/extensions.json
{
  "recommendations": [
    "ms-vscode.vscode-json",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

### Performance Monitoring Setup

```bash
# Install monitoring dependencies
pnpm add -D lighthouse @lhci/cli

# Configure Lighthouse CI
lhci autorun
```

## 📚 Related Documentation

- **[Development Setup](./SETUP.md)** - Environment configuration
- **[Testing Guide](../testing/README.md)** - Testing strategies
- **[Monitoring Guide](../operations/monitoring.md)** - Production monitoring
- **[Bundle Analysis](../development/bundle-analysis.md)** - Bundle optimization

## 🆘 Getting Performance Help

### **Performance Checklist**

- [ ] Bundle size under 500KB?
- [ ] LCP under 2.5s?
- [ ] API responses under 200ms?
- [ ] Database queries under 50ms?
- [ ] No memory leaks?

### **Performance Escalation**

1. **Self-debug** using this guide
2. **Bundle analysis** - `pnpm run analyze`
3. **Team review** - Performance bottlenecks often need team input
4. **External audit** - Consider performance consulting for complex issues

---

**Last Updated:** October 17, 2025
**Performance Philosophy:** "Fast is a feature - every interaction should feel instant"
