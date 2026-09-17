# Development Documentation

**This page is a 2025-12-30 snapshot. It is not a current production-readiness statement. Do not read "Production Ready" below as today's status.**

**Last Updated of this snapshot:** 2025-12-30
**Honesty pass:** 2026-09-03 — OrangeCat is live at [orangecat.ch](https://orangecat.ch). Treat the architecture notes as historical unless re-verified.

---

## Snapshot status (2025-12-30 — stale)

The 2025-12-30 header said "Production Ready". That claim is **stale**. The linked Production Readiness Handoff at `docs/development/HANDOFF_PRODUCTION_READINESS.md` **404s**; a copy lives at [`docs/archive/2026-h1/HANDOFF_PRODUCTION_READINESS.md`](../archive/2026-h1/HANDOFF_PRODUCTION_READINESS.md). Remaining-work figures from that snapshot (~460 TypeScript errors, ~160 `console.log`s) are **not** current gates.

**Then (snapshot notes, not today's gate):**
**Build:** Passing
**Database:** Verified (3 groups, 17 actors, 3 members)
**Groups Unification:** Complete
**Actor System:** Implemented

### Active Status Documents
- **[Archived Production Readiness Handoff](../archive/2026-h1/HANDOFF_PRODUCTION_READINESS.md)** - 2025 snapshot; the original `./HANDOFF_PRODUCTION_READINESS.md` 404s
- **[Active Refactoring Tasks](./ACTIVE_REFACTORING_TASKS.md)** - 2025 work tracker (also dated; re-verify before trusting)

---

## Architecture & Principles

- **[Engineering Principles](./ENGINEERING_PRINCIPLES.md)** - DRY, SSOT, best practices
- **[Modularity Improvements](./MODULARITY_IMPROVEMENTS.md)** - Modular architecture patterns
- **[Code Simplicity](./CODE_SIMPLICITY.md)** - Simplicity guidelines

### Analysis Documents
- **[Search Architecture Analysis](./SEARCH_ARCHITECTURE_ANALYSIS.md)** - Search system deep dive
- **[Discover Page Analysis](./DISCOVER_PAGE_ANALYSIS.md)** - Discover page architecture
- **[Entity Cards Unification](./ENTITY_CARDS_UNIFICATION_PLAN.md)** - Entity cards DRY plan

---

## Development Guides

### Setup & Configuration
- **[Setup Guide](./SETUP.md)** - Development environment setup
- **[Environment Management](./environment-management.md)** - Environment variables

### Code Patterns
- **[CLI Entity Creation](./CLI_ENTITY_CREATION.md)** - Entity creation via CLI
- **[Generic API Handlers](./GENERIC_API_HANDLERS.md)** - API handler patterns
- **[Type Safety Prevention](./TYPE_SAFETY_PREVENTION.md)** - TypeScript best practices
- **[Type Safety Progress](./TYPE_SAFETY_PROGRESS.md)** - Current type safety status

### Workflows
- **[Git Workflow](./git-workflow.md)** - Git branching and commits
- **[Code Review](./code-review.md)** - Review process
- **[Error Handling](./error-handling.md)** - Error handling patterns
- **[Debugging](./debugging.md)** - Debugging guide

### Handoff System
- **[Handoff System](./HANDOFF_SYSTEM.md)** - How handoffs work
- **[Handoff Template](./HANDOFF_TEMPLATE.md)** - Template for session handoffs

---

## Key Architectural Decisions

### Groups Unification (Completed)
- Circles and Organizations merged into unified `groups` table
- Groups have `label` field (circle, dao, company, network_state, etc.)
- All queries use `groups` table only - no dual-table logic

### Actor Model (Completed)
- Entities owned by `actor_id` (unified ownership model)
- Actors can be users or groups
- Future extensible for AI agents

### Entity Cards (90% Complete)
- Single `EntityCard` base component with variants
- `ProjectCard` extends EntityCard with project-specific features
- Old duplicate cards being phased out

---

## Remaining Work (from the 2025-12-30 snapshot — not a current inventory)

1. **TypeScript Errors** - snapshot cited ~460 non-blocking errors; do not treat as today's count
2. **Console.log Cleanup** - snapshot cited ~160 statements to replace with logger
3. **Delete Old Components** - ModernProjectCard, DashboardProjectCard after testing
4. **Remove Organizations Table** - After verification period

---

## File Locations

### Services
- `src/services/groups/` - Groups service (queries, mutations, permissions)
- `src/services/actors/` - Actor service (unified ownership)
- `src/services/projects/support/` - Project support system

### API Routes
- `src/app/api/groups/` - Groups API
- `src/app/api/organizations/` - Backward-compatible wrapper

### Components
- `src/components/entity/EntityCard.tsx` - Base entity card
- `src/components/entity/variants/` - Entity card variants
- `src/components/groups/` - Group components

---

**Note:** Stale documentation has been cleaned up. See `docs/archive/` for historical docs if needed.
