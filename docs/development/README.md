# Development Documentation

Guides for working in the OrangeCat codebase. The rules an agent must follow
live in [`../../.claude/`](../../.claude/) and the root
[`CLAUDE.md`](../../CLAUDE.md); this folder holds the longer explanations
behind them. Point-in-time status reports, trackers and handoffs that used to
sit here are in [`../archive/`](../archive/).

## Architecture & Principles

- **[Engineering Principles](./ENGINEERING_PRINCIPLES.md)** - DRY, SSOT, best practices
- **[Best Practices](./BEST_PRACTICES.md)** - Day-to-day conventions
- **[Code Simplicity](./CODE_SIMPLICITY.md)** - Simplicity guidelines
- **[Extensibility Guide](./EXTENSIBILITY_GUIDE.md)** - Adding group types and entity types
- **[Products/Store Architecture](./PRODUCTS_STORE_ARCHITECTURE.md)** - Unified store model
- **[Currency System Explained](./CURRENCY_SYSTEM_EXPLAINED.md)** and **[Currency Behavior](./CURRENCY_BEHAVIOR_EXPLAINED.md)**

## Setup & Configuration

- **[Setup Guide](./SETUP.md)** - Development environment setup
- **[Environment Management](./environment-management.md)** - Environment variables

## Code Patterns

- **[CLI Entity Creation](./CLI_ENTITY_CREATION.md)** - Entity creation via CLI
- **[Generic API Handlers](./GENERIC_API_HANDLERS.md)** - API handler factories
- **[Type Safety Prevention](./TYPE_SAFETY_PREVENTION.md)** - TypeScript best practices
- **[Hooks](./hooks-guide.md)**, **[Types](./types-guide.md)**, **[Utils](./utils-guide.md)** - Directory guides
- **[Component Architecture](./components/component-architecture.md)**
- **[Standards](./standards/)** and **[Templates](./templates/)**

## Workflows

- **[Git Workflow](./git-workflow.md)** and **[Branch Strategy](./contributing/BRANCH_STRATEGY.md)**
- **[Contributing](./contributing/CONTRIBUTING.md)**
- **[Code Review](./code-review.md)** - Review process
- **[Error Handling](./error-handling.md)** - Error handling patterns
- **[Debugging](./debugging.md)** and **[Performance Debugging](./performance-debugging.md)**
- **[Messaging System](./messaging-system.md)** - Notes on direct messages

## Where things live

- Entity metadata: `src/config/entity-registry.ts`
- Business logic: `src/domain/` (one folder per domain)
- Groups: `src/services/groups/`, API in `src/app/api/groups/`
- Actors (unified ownership): `src/services/actors/`
- Entity cards: `src/components/entity/EntityCard.tsx`
