# 🚨 OrangeCat Error Handling Guide

**Comprehensive guide to error handling, logging, and debugging across the OrangeCat platform.**

## 🎯 Error Handling Philosophy

**"Errors are information"** - Every error tells us something about our system. Handle them gracefully, learn from them, and prevent them from happening again.

## 🔍 Error Types & Categories

### Error Classification

```typescript
enum ErrorSeverity {
  LOW = 'low', // Minor issues, user can continue
  MEDIUM = 'medium', // Degraded functionality
  HIGH = 'high', // Significant impact, needs attention
  CRITICAL = 'critical', // System down, immediate action required
}

enum ErrorCategory {
  VALIDATION = 'validation', // Input validation errors
  AUTHENTICATION = 'authentication', // Auth failures
  AUTHORIZATION = 'authorization', // Permission issues
  DATABASE = 'database', // Database errors
  NETWORK = 'network', // Network/API errors
  BUSINESS_LOGIC = 'business_logic', // Business rule violations
  EXTERNAL_SERVICE = 'external_service', // Third-party service errors
  SYSTEM = 'system', // System-level errors
}
```

## 🛠️ Error Handling Implementation

### Frontend Error Boundaries

```tsx
import { ErrorBoundary } from 'react-error-boundary';

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div role="alert">
      <p>Something went wrong:</p>
      <pre>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}

// Wrap your app
<ErrorBoundary FallbackComponent={ErrorFallback}>
  <App />
</ErrorBoundary>;
```

### API Error Handling

```typescript
// src/lib/errors.ts
import { errorHandler } from './error-handler';

export async function handleApiError(error: unknown, request?: any) {
  const context = createErrorContext(request);
  errorHandler.handle(error as Error, context);

  // Return user-friendly error
  if (error instanceof ApiError) {
    return new Response(
      JSON.stringify({
        error: error.message,
        code: error.code,
      }),
      { status: error.statusCode }
    );
  }

  return new Response(
    JSON.stringify({
      error: 'An unexpected error occurred',
    }),
    { status: 500 }
  );
}
```

### Database Error Handling

```typescript
// Database operations with error handling
export async function safeDatabaseOperation<T>(operation: () => Promise<T>): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    errorHandler.handle(new DatabaseError('Database operation failed', error as Error));
    return null;
  }
}
```

## 📊 Error Monitoring & Logging

### Structured Logging

```typescript
import { logger } from '@/utils/logger';

// Different log levels
logger.debug('Debug information', { userId, action });
logger.info('User action completed', { userId, action });
logger.warn('Potential issue detected', { error, context });
logger.error('Critical error occurred', { error, stack, context });
```

### Error Tracking Service

```typescript
// Production error tracking
import * as Sentry from '@sentry/nextjs';

try {
  // Your code here
} catch (error) {
  Sentry.captureException(error, {
    tags: { component: 'UserProfile' },
    user: { id: userId },
    extra: { action: 'updateProfile' },
  });
}
```

### Performance Impact Tracking

```typescript
// Track error performance impact
const errorMetrics = {
  errorCount: 0,
  errorTypes: new Map(),
  performanceDegradation: 0,
};

function trackError(error: Error) {
  errorMetrics.errorCount++;
  const errorType = error.constructor.name;
  errorMetrics.errorTypes.set(errorType, (errorMetrics.errorTypes.get(errorType) || 0) + 1);
}
```

## 🚨 Error Recovery Strategies

### Retry Logic

```typescript
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      logger.warn(`Operation failed, retrying in ${delay}ms`, { error });
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
  throw new Error('Max retries exceeded');
}
```

### Graceful Degradation

```typescript
function renderWithFallback() {
  try {
    return <ExpensiveComponent />;
  } catch (error) {
    logger.error('Component failed to render', { error });
    return <FallbackComponent />;
  }
}
```

### User-Friendly Error Messages

```typescript
function getUserFriendlyError(error: AppError): string {
  switch (error.category) {
    case ErrorCategory.VALIDATION:
      return 'Please check your input and try again.';
    case ErrorCategory.AUTHENTICATION:
      return 'Please sign in to continue.';
    case ErrorCategory.AUTHORIZATION:
      return "You don't have permission to perform this action.";
    case ErrorCategory.DATABASE:
      return "We're experiencing technical difficulties. Please try again later.";
    case ErrorCategory.NETWORK:
      return 'Network error occurred. Please check your connection and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
```

## 🧪 Error Testing

### Error Scenario Testing

```typescript
test('should handle network errors gracefully', async () => {
  // Mock network failure
  mockFetch.mockRejectedValue(new Error('Network error'));

  render(<ComponentThatFetchesData />);

  await waitFor(() => {
    expect(screen.getByText('Network error occurred')).toBeInTheDocument();
  });
});

test('should retry failed operations', async () => {
  const mockOperation = jest.fn()
    .mockRejectedValueOnce(new Error('Temporary failure'))
    .mockResolvedValueOnce('success');

  const result = await retryOperation(mockOperation, 2);

  expect(mockOperation).toHaveBeenCalledTimes(2);
  expect(result).toBe('success');
});
```

### Error Boundary Testing

```typescript
test('should render error fallback when component throws', () => {
  const ThrowError = () => {
    throw new Error('Test error');
  };

  render(
    <ErrorBoundary>
      <ThrowError />
    </ErrorBoundary>
  );

  expect(screen.getByText('Something went wrong')).toBeInTheDocument();
});
```

## 📈 Error Metrics & Monitoring

### Error Rate Monitoring

```typescript
// Track error rates by category
const errorRates = {
  validation: 0,
  authentication: 0,
  database: 0,
  network: 0,
};

function updateErrorMetrics(error: AppError) {
  const category = error.category;
  errorRates[category] = (errorRates[category] || 0) + 1;

  // Alert if error rate exceeds threshold
  if (errorRates[category] > 10) {
    alert(`High error rate in ${category} category`);
  }
}
```

### Performance Impact Tracking

```typescript
// Monitor how errors affect performance
const performanceImpact = {
  errorsThisMinute: 0,
  responseTimeBaseline: 150, // ms
  currentResponseTime: 150,
};

function trackErrorPerformance(error: AppError) {
  performanceImpact.errorsThisMinute++;

  // If many errors, performance might be degraded
  if (performanceImpact.errorsThisMinute > 5) {
    logger.warn('High error rate may impact performance', {
      errorsPerMinute: performanceImpact.errorsThisMinute,
    });
  }
}
```

## 🔧 Development Error Handling

### Development Error Logging

```typescript
// Enhanced console logging for development
if (process.env.NODE_ENV === 'development') {
  const originalError = console.error;
  console.error = (...args) => {
    originalError('🚨 ERROR:', ...args);
    // Additional debugging info
  };
}
```

### Error Debugging Tools

```typescript
// Development error inspector
function inspectError(error: Error) {
  if (process.env.NODE_ENV === 'development') {
    console.group('🔍 Error Inspection');
    console.log('Message:', error.message);
    console.log('Stack:', error.stack);
    console.log('Name:', error.name);
    console.groupEnd();
  }
}
```

## �� Production Error Handling

### Silent Failures (Avoid)

```typescript
// ❌ Bad: Silent failures hide problems
try {
  riskyOperation();
} catch (error) {
  // Do nothing - user never knows something went wrong
}
```

### User Communication

```typescript
// ✅ Good: Inform user and provide recovery options
try {
  await updateUserProfile(data);
} catch (error) {
  showErrorMessage('Failed to update profile. Please try again.');
  // Log for debugging
  logger.error('Profile update failed', { error, userId });
}
```

### Error Recovery UI

```tsx
function ErrorRecovery({ error, onRetry }) {
  return (
    <div className="error-recovery">
      <p>⚠️ Something went wrong</p>
      <button onClick={onRetry}>Try Again</button>
      <button onClick={() => window.location.reload()}>Reload Page</button>
    </div>
  );
}
```

## �� Error Documentation

### Error Code Reference

```typescript
// Common error codes and their meanings
const ERROR_CODES = {
  VALIDATION_ERROR: 'Input validation failed',
  AUTHENTICATION_ERROR: 'User authentication required',
  AUTHORIZATION_ERROR: 'Insufficient permissions',
  DATABASE_ERROR: 'Database operation failed',
  NETWORK_ERROR: 'Network request failed',
  RATE_LIMIT_ERROR: 'Too many requests',
  SYSTEM_ERROR: 'Internal system error',
};
```

### Error Response Format

```json
{
  "success": false,
  "error": "User-friendly error message",
  "code": "ERROR_CODE",
  "retryable": true/false,
  "timestamp": "2025-01-01T12:00:00Z"
}
```

## 🛡️ Security Considerations

### Error Information Disclosure

```typescript
// ❌ Bad: Expose internal details
catch (error) {
  return { error: error.message, stack: error.stack }; // Security risk
}

// ✅ Good: Sanitized error messages
catch (error) {
  logger.error('Internal error', { error }); // Log details internally
  return { error: 'Something went wrong' }; // Return safe message
}
```

### Error-based Attacks Prevention

```typescript
// Prevent error-based information disclosure
function safeErrorMessage(error: Error): string {
  // Don't expose database errors, file paths, or internal details
  if (error instanceof DatabaseError) {
    return 'Database temporarily unavailable';
  }

  if (error.message.includes('password')) {
    return 'Authentication failed';
  }

  return 'An error occurred';
}
```

## 🔄 Error Recovery Patterns

### Circuit Breaker Pattern

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > 60000) {
        // 1 minute
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= 5) {
      this.state = 'OPEN';
    }
  }
}
```

### Fallback Strategies

```typescript
async function getUserProfile(userId: string) {
  try {
    return await api.getProfile(userId);
  } catch (error) {
    // Fallback to cached data
    const cached = await getCachedProfile(userId);
    if (cached) return cached;

    // Fallback to default profile
    return getDefaultProfile();
  }
}
```

## 📊 Error Analytics

### Error Rate Monitoring

```typescript
// Track error rates over time
const errorAnalytics = {
  errorsByHour: new Map(),
  errorsByCategory: new Map(),
  errorsByEndpoint: new Map(),
};

function recordError(error: AppError, endpoint?: string) {
  const hour = new Date().getHours();
  const hourKey = `hour_${hour}`;

  errorAnalytics.errorsByHour.set(hourKey, (errorAnalytics.errorsByHour.get(hourKey) || 0) + 1);

  errorAnalytics.errorsByCategory.set(
    error.category,
    (errorAnalytics.errorsByCategory.get(error.category) || 0) + 1
  );

  if (endpoint) {
    errorAnalytics.errorsByEndpoint.set(
      endpoint,
      (errorAnalytics.errorsByEndpoint.get(endpoint) || 0) + 1
    );
  }
}
```

### Error Trend Analysis

```typescript
function analyzeErrorTrends() {
  const trends = {
    increasingErrors: false,
    errorHotspots: [],
    peakErrorTimes: [],
  };

  // Analyze error patterns
  const recentErrors = getErrorsLast24Hours();
  const previousErrors = getErrorsPrevious24Hours();

  if (recentErrors.length > previousErrors.length * 1.5) {
    trends.increasingErrors = true;
  }

  return trends;
}
```

## 🆘 Error Handling Best Practices

### ✅ Do's

- **Log all errors** with appropriate context
- **Provide user-friendly messages** for all errors
- **Implement retry logic** for transient failures
- **Use error boundaries** to prevent app crashes
- **Monitor error rates** and set up alerts
- **Test error scenarios** in your test suite

### ❌ Don'ts

- **Don't expose internal error details** to users
- **Don't silently ignore errors** - always log them
- **Don't show technical error messages** to end users
- **Don't retry non-idempotent operations** without care
- **Don't log sensitive information** in error messages

## 📚 Related Documentation

- **[Debugging Guide](./debugging.md)** - Development debugging techniques
- **[Observability](../operations/devops/observability.md)** - Production monitoring
- **[Security Guide](../security/README.md)** - Security error handling
- **[Testing Guide](../testing/README.md)** - Error scenario testing

## 🆘 Getting Error Handling Help

### **Error Handling Checklist**

- [ ] Error properly logged with context?
- [ ] User-friendly message provided?
- [ ] Error recovery options available?
- [ ] Security considerations addressed?
- [ ] Performance impact monitored?

### **Escalation Path**

1. **Check this guide** - Most common patterns covered
2. **Review error logs** - Look for patterns and root causes
3. **Team discussion** - Complex error handling often needs team input
4. **External resources** - Error handling patterns and best practices

---

**Last Updated:** October 17, 2025
**Error Handling Philosophy:** "Errors are information - handle them gracefully, learn from them, prevent them"
