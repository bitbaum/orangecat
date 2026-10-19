# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Modular architecture with separation of concerns
- Type definitions for Profile and Dashboard
- Supabase client configuration
- Profile service with CRUD operations
- Custom authentication hook
- Reusable UI components (Button, Input, Card)
- Dashboard card component
- Configuration management for dashboard data
- Profile editing functionality with real-time updates
- Improved state management using Zustand
- Unified Campaign Store (`useCampaignStore`) - single source of truth for all project/draft management
- Campaign migration utility for legacy data cleanup
- Debug tool for project state inspection (`/debug-drafts.html`)
- **SECURITY**: Comprehensive celebrity impersonation prevention system (2025-06-06)
  - 75+ protected celebrity/brand usernames
  - Character substitution attack detection (e.g., 3l0n_mu5k → elonmusk)
  - Unicode lookalike character prevention
  - Bio content analysis for authority claims
  - 25 comprehensive security tests
- **SECURITY**: Advanced file upload security system (2025-06-06)
  - Mandatory user authentication for uploads
  - Magic byte validation for file type verification
  - Malicious content scanning and rejection
  - Automatic metadata stripping for privacy
  - Path traversal attack prevention
- **SECURITY**: Structured logging system (2025-06-06)
  - Replaced 85%+ of console.log statements with proper logger
  - Eliminated production data exposure
  - Development-only console statements for debugging

### Changed

- Refactored home page to use modular components
- Improved code organization and maintainability
- Enhanced type safety across the application
- **MAJOR**: Completed unified project architecture migration (2025-06-05)
  - Migrated all components to use single `useCampaignStore`
  - Removed competing draft systems (`useDrafts`, `useProjects`, `useTeslaDrafts`)
  - Eliminated data inconsistencies and race conditions
  - Improved performance by removing duplicate API calls
- **SECURITY**: Enhanced authentication system (2025-06-06)
  - Fixed auth state inconsistencies
  - Improved session validation
  - Added comprehensive auth testing (21 tests)
- **SECURITY**: Hardened Bitcoin address validation (2025-06-06)
  - Enhanced regex patterns for mainnet validation
  - Testnet address prevention
  - Burn address detection
  - Lightning address security improvements

### Fixed

- **SECURITY**: File upload authorization bypass - users can no longer upload files for other users
- **SECURITY**: Celebrity impersonation vulnerability - comprehensive username protection implemented
- **SECURITY**: Console.log data exposure - production logging sanitized
- **SECURITY**: Auth state inconsistencies - proper state management implemented
- Profile update rate limiting abuse prevention
- Enhanced Bitcoin address validation preventing invalid donations

### Security

- **CRITICAL FIXES COMPLETED** (2025-06-06):
  - Fixed file upload authorization bypass (EXTREME risk)
  - Implemented celebrity impersonation prevention (CRITICAL risk)
  - Eliminated console.log data exposure (HIGH risk)
  - Resolved auth state inconsistencies (HIGH risk)
- **Security Test Coverage**: 77 comprehensive security tests implemented
- **Risk Level Reduced**: From CRITICAL (3186/6000) to MANAGEABLE
- Multi-layer validation for all user inputs
- Rate limiting for abuse prevention
- Comprehensive audit logging (structured, not console.log)

### Testing

- **DISCOVERY**: Critical test coverage gap identified (2025-06-06)
  - Current coverage: 4.9% (Target: 85%)
  - 85% of codebase runs without tests
  - Major risk for production deployment
- **Security Testing**: Comprehensive security test suite added
  - 25 celebrity impersonation prevention tests
  - 21 authentication tests
  - 9 file upload security tests
  - 8 profile security tests
  - 6 funding security tests

### Removed

- Legacy draft management hooks: `useDrafts`, `useProjects`, `useTeslaDrafts`
- Obsolete `TeslaDraftDashboard` component
- Competing state management systems causing data conflicts
- **SECURITY**: Production console.log statements exposing sensitive data
- **SECURITY**: Unsafe file upload processing without validation

### Technical Debt

- **CRITICAL**: Test coverage needs to reach 85% before production (currently 4.9%)
  - Need component testing for UI elements
  - Need integration testing for user journeys
  - Need service layer testing for business logic
- Need to replace 200+ TypeScript `any` types with proper interfaces
- Need to split large files (supabase/client.ts: 1076 lines)
- Need to extract duplicate file upload validation logic (600+ lines)
- Need to break down oversized components (>200 lines)
- ~~Need to implement profile creation flow~~ ✅ **COMPLETED**
- ~~Need to add Bitcoin integration~~ ✅ **COMPLETED**
- ~~Need to set up protected routes~~ ✅ **COMPLETED**
- ~~Need to add testing infrastructure~~ ✅ **PARTIAL** (security tests only)
- ~~Need to unify project/draft management~~ ✅ **COMPLETED**
- ~~Need to fix critical security vulnerabilities~~ ✅ **COMPLETED**

## [Initial Setup]

- Project initialization
- Basic Next.js setup
- Supabase integration
- Basic UI components

## [1.0.0] - 2024-04-13

### Changed

- Complete rebranding to OrangeCat
- Migrated to Bitcoin Lightning Network for payments
- Updated site URL to orangecat.ch
- Improved user profile system
- Enhanced Bitcoin payment integration

### Added

- Bitcoin and Lightning Network payment support
- New profile fields for Bitcoin and Lightning addresses
- Real-time Bitcoin payment tracking
- Enhanced security features

### Removed

- Legacy payment system
- Old branding elements

## [0.1.0] - 2024-04-01

### Added

- Initial release
- Basic user authentication
- Profile creation
- Funding page system
- Created deployment documentation (DEPLOYMENT.md)
- Updated environment variables for production
- Enhanced Next.js configuration for production
- Added security headers
- Updated metadata configuration
- Added robots.txt configuration
- Added secure secret management system

### Changed

- Rebranded from Palfare to OrangeCat
- Updated all documentation to reflect new branding
- Updated site URL from palfare.com to orangecat.com
- Enhanced layout metadata
- Improved environment variable handling
- Updated image domains configuration
- Moved sensitive information to secure storage

### Fixed

- Removed experimental server actions flag
- Fixed environment variable defaults
- Enhanced security headers
- Removed exposed Bitcoin address from version control
- Secured API keys and configuration
- Resolved issues with asynchronous operations and localStorage

### Security

- Added security headers
- Implemented proper error handling
- Added security policy
- Added environment variable validation
- Secured sensitive information
- Implemented proper secret management

## [0.1.0] - Initial Setup

- Initial project setup
- Basic routing implementation
- Donation page creation
- Bitcoin integration setup

### Deprecated

- N/A

### Removed

- N/A
