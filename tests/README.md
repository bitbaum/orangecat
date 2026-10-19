# Tests Directory

This directory contains all test files organized by type and purpose.

## Directory Structure

- **`auth/`** - Authentication-related tests
- **`e2e/`** - End-to-end tests using Playwright
- **`manual/`** - Manual testing scripts and utilities
- **`security/`** - Security-focused tests
- **`setup/`** - Test setup and configuration

## Test Types

- **Unit Tests**: Located in `__tests__/` directories next to source files
- **Integration Tests**: API and service integration tests
- **E2E Tests**: Full user journey tests using Playwright
- **Security Tests**: Security vulnerability and policy tests
- **Manual Tests**: Scripts for manual testing scenarios

## Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Security tests
npm run test:security

# Auth tests
npm run test:auth
```

## Test Configuration

- `vitest.config.ts` (repo root) - Vitest configuration
- `playwright.config.ts` - Playwright E2E configuration
- `setup.ts` - Global test setup
- `TestWrapper.tsx` - React testing utilities
