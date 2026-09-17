# OrangeCat Comprehensive Testing Guide

## Overview

This guide provides detailed instructions for using OrangeCat's comprehensive testing infrastructure, covering unit tests, integration tests, end-to-end tests, performance tests, and security tests.

## Quick Start

### Run All Tests

```bash
pnpm run test:all
```

### Run Specific Test Types

```bash
# Unit tests only
pnpm run test:unit

# Integration tests only
pnpm run test:integration

# End-to-end tests only
pnpm run test:e2e

# Performance tests only
pnpm run test:performance

# Security tests only
pnpm run test:security
```

### Run with Coverage

```bash
pnpm run test:coverage
```

### Watch Mode

```bash
pnpm run test:watch
```

## Test Types

### 1. Unit Tests

**Purpose**: Test individual functions, components, and services in isolation.

**Location**: `src/__tests__/` and `src/*/tests/`

**Framework**: Vitest with Testing Library

**Coverage Target**: 85%+

#### Writing Unit Tests

```typescript
// src/components/__tests__/Button.test.tsx
import { render, screen } from '@testing-library/react';
import { Button } from '../Button';

describe('Button Component', () => {
  test('should render button with text', () => {
    render(<Button>Click me</Button>);

    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  test('should handle click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    screen.getByRole('button').click();

    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### 2. Integration Tests

**Purpose**: Test interactions between components and services.

**Location**: `tests/integration/`

**Framework**: Vitest

#### Writing Integration Tests

```typescript
// tests/integration/auth-integration.test.ts
import { ProfileService } from '@/services/profileService';
import { createTestUser } from '@/tests/utils';

describe('ProfileService Integration', () => {
  test('should integrate with Supabase', async () => {
    const user = createTestUser();
    const profile = await ProfileService.getProfile(user.id);

    expect(profile).toBeDefined();
    expect(profile.id).toBe(user.id);
  });
});
```

### 3. End-to-End Tests

**Purpose**: Test complete user journeys from browser perspective.

**Location**: `tests/e2e/`

**Framework**: Playwright

#### Writing E2E Tests

```typescript
// tests/e2e/user-journey.spec.ts
import { test, expect } from '@playwright/test';

test.describe('User Journey', () => {
  test('should complete user registration', async ({ page }) => {
    await page.goto('/auth');

    await page.getByRole('textbox', { name: /email/i }).fill('test@example.com');
    await page.getByRole('textbox', { name: /password/i }).fill('password123');
    await page.getByRole('button', { name: /sign up/i }).click();

    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText('Welcome to OrangeCat')).toBeVisible();
  });
});
```

### 4. Performance Tests

**Purpose**: Test application performance under load.

**Location**: `tests/performance/`

**Framework**: Playwright with Lighthouse

#### Writing Performance Tests

```typescript
// tests/performance/critical-path.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Performance', () => {
  test('should meet Core Web Vitals', async ({ page }) => {
    await page.goto('/');

    const metrics = await page.evaluate(() => {
      return performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    });

    expect(metrics.loadEventEnd - metrics.loadEventStart).toBeLessThan(3000); // LCP < 3s
  });
});
```

### 5. Security Tests

**Purpose**: Test for security vulnerabilities.

**Location**: `tests/security/`

**Framework**: Custom security testing framework

#### Writing Security Tests

```typescript
// tests/security/xss-prevention.test.ts
import { securityUtils } from '@/tests/utils';

describe('XSS Prevention', () => {
  test('should sanitize malicious input', () => {
    const maliciousInput = '<script>alert("XSS")</script>';
    const sanitized = sanitizeInput(maliciousInput);

    securityUtils.testSanitization(maliciousInput, sanitized);
    expect(sanitized).not.toContain('<script>');
  });
});
```

## Test Configuration

### Vitest Configuration

OrangeCat uses Vitest for comprehensive testing:

- **Main Config**: `vitest.config.ts`
- **Setup File**: `vitest.setup.ts`
- **Coverage Thresholds**: 85-85% across different modules

### Playwright Configuration

Multiple Playwright configurations for different test types:

- **Main Config**: `playwright.config.advanced.ts`
- **Performance Config**: `playwright.config.performance.ts`
- **Security Config**: `playwright.config.security.ts`

## Test Utilities

### Shared Utilities

The `tests/utils.ts` file provides comprehensive test utilities:

```typescript
import { testUtils } from '@/tests/utils';

// Create test data
const user = testUtils.createTestUser({
  username: 'testuser',
  email: 'test@example.com',
});

// Mock API responses
const mockResponse = testUtils.mockApiResponse(200, { success: true });

// Mock time
testUtils.timeUtils.mockDate('2023-01-01');
```

### Available Utilities

- **Data Factories**: `createTestUser`, `createTestCampaign`
- **API Mocking**: `mockApiResponse`, `mockFetch`
- **Time Control**: `timeUtils` for date/time mocking
- **Security Testing**: `securityUtils` for XSS/SQL injection testing

## Running Tests

### Command Line Options

```bash
# Run comprehensive test suite
node scripts/comprehensive-test.js

# Run specific test types
node scripts/comprehensive-test.js --unit --integration --e2e

# Run with coverage
node scripts/comprehensive-test.js --coverage

# Watch mode
node scripts/comprehensive-test.js --watch

# Verbose output
node scripts/comprehensive-test.js --verbose

# Specific browser for E2E tests
node scripts/comprehensive-test.js --e2e --browser=firefox
```

### Environment Variables

Set environment variables for different test environments:

```bash
# Test database
export TEST_DATABASE_URL="postgresql://test:test@localhost:5432/orangecat_test"

# Supabase test configuration
export NEXT_PUBLIC_SUPABASE_URL="https://test.supabase.co"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="test-anon-key"

# Bitcoin test configuration
export BITCOIN_NETWORK="testnet"
export BITCOIN_API_KEY="test-api-key"
```

## Test Reports

### Coverage Reports

Coverage reports are generated in the `coverage/` directory:

```bash
# Generate coverage report
pnpm run test:coverage

# View coverage report
open coverage/lcov-report/index.html
```

### Test Results

Detailed test results are available in the `test-results/` directory:

- **JUnit XML**: `test-results/junit.xml`
- **HTML Report**: `test-results/unit-report.html`
- **E2E Results**: `test-results/e2e-results.json`

### Playwright Reports

Playwright generates comprehensive reports:

```bash
# View Playwright report
pnpm exec playwright show-report

# View with specific configuration
pnpm exec playwright show-report playwright-report/
```

## CI/CD Integration

### GitHub Actions

The test suite is integrated with GitHub Actions:

```yaml
# .github/workflows/test.yml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - name: Run comprehensive tests
        run: pnpm run test:all
```

### Pre-commit Hooks

Tests run automatically before commits:

```bash
# Pre-commit hook runs unit tests
pnpm run test:unit
```

## Best Practices

### Writing Maintainable Tests

1. **Use Descriptive Names**: Test names should explain what they're testing
2. **Test Behavior, Not Implementation**: Focus on what the code does, not how
3. **Keep Tests Independent**: Each test should be able to run in isolation
4. **Use Test Data Factories**: Create reusable test data generators
5. **Mock External Dependencies**: Isolate tests from external services

### Test Organization

```
__tests__/                    # Vitest unit tests
  /components/                # Component tests
  /services/                  # Service tests
  /utils/                     # Utility tests

tests/                        # Integration and E2E tests
  /e2e/                       # Playwright E2E tests
    /auth/                    # Authentication flows
    /donations/               # Donation flows
    /projects/               # Campaign management
  /integration/               # Vitest integration tests
  /performance/               # Performance tests
  /security/                  # Security tests
```

### Performance Testing

- Test critical user paths regularly
- Monitor Core Web Vitals (LCP, FID, CLS)
- Test with realistic data sizes
- Monitor memory usage and leaks

### Security Testing

- Test input validation thoroughly
- Include XSS and injection attack vectors
- Test authentication and authorization
- Verify data encryption and storage

## Debugging Tests

### Debug Vitest Tests

```bash
# Debug specific test
pnpm run test:unit -t "should do something"

# Debug with verbose output
pnpm test --reporter=verbose

# Run tests in watch mode
pnpm run test:watch
```

### Debug Playwright Tests

```bash
# Debug E2E tests
pnpm exec playwright test --debug

# Run specific test
pnpm exec playwright test user-journey.spec.ts

# Run with UI mode
pnpm exec playwright test --ui
```

### Debug Performance Tests

```bash
# Run performance tests with tracing
pnpm exec playwright test --trace on

# View performance traces
pnpm exec playwright show-trace test-results/trace.zip
```

## Troubleshooting

### Common Issues

1. **Tests timing out**: Increase timeout in test configuration
2. **Mock not working**: Ensure proper mocking setup in test files
3. **Coverage not generating**: Check Vitest configuration and file patterns
4. **Playwright browser not found**: Run `pnpm exec playwright install`

### Getting Help

- Check the [Vitest documentation](https://vitest.dev/guide/)
- Check the [Playwright documentation](https://playwright.dev/docs/intro)
- Review existing tests for patterns and examples
- Ask in the development team chat

## Conclusion

This comprehensive testing infrastructure ensures OrangeCat maintains high quality, security, and performance standards. Regular testing catches issues early and maintains code reliability as the platform grows.

---

**Created**: 2025-09-24
**Last Modified**: 2025-09-24
**Last Modified Summary**: Comprehensive testing guide for OrangeCat
