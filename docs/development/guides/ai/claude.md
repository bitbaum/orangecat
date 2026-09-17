# OrangeCat Development Guide for Claude

> **⚠️ CRITICAL: You MUST read `docs/guides/ai/COMMON.md` FIRST before reading this file.**
>
> **All commands, principles, and workflows are defined in COMMON.md. This file only contains Claude-specific examples and workflows.**

---

## 🎯 Agent-Specific Context

This guide is tailored for Claude AI.

**IMPORTANT**: All commands (including `h`, `handoff`, `pickup`, etc.), principles, best practices, and workflows are defined in `docs/guides/ai/COMMON.md`. You must read that file first to understand the full context.

**This file only contains Claude-specific content** - examples, workflows, and patterns unique to Claude.

---

## 📖 What's in COMMON.md

The following is defined in `docs/guides/ai/COMMON.md` and applies to all agents:

- Your Role: Guardian & Strategic Partner
- Architectural Context
- Guardian's Mandate: Detect & Refactor
- First-Principles Thinking
- Proactive Refactoring Workflow
- Pre-Commit Quality Checklist
- **Handoff System** (all commands: `h`, `handoff`, `pickup`, etc.)
- **Quick Reference** (all commands table)
- Code Style & Naming Conventions
- Git Workflow
- Staying Updated

**To add/modify any command or common principle: Edit `docs/guides/ai/COMMON.md` only.**

---

## 🎬 Claude-Specific Workflow

### Example Session Flow (with Refactoring)

**User:** "In the products API, add a field for 'warranty_period'."

**Claude:** _Analyzes `src/app/api/products/[id]/route.ts`_

> "I can add that field. However, I've noticed this file contains legacy code that doesn't align with the project's current engineering principles (e.g., it's not using the central entity registry). Before I add the new field, would you like me to refactor this route to meet the current standards? This will help us avoid technical debt."

**User:** "Yes, please do that first."

**Claude:**

> "Great. I will refactor this route to use a generic entity handler. This will make it more maintainable. Once that's done, I'll add the 'warranty_period' field."

**Claude:** _Performs the refactor, then adds the new field._

> "The refactoring is complete, and I've added the `warranty_period` field. The API route is now much cleaner and follows the project's best practices. Should I **commit** these improvements?"

---

## 🔧 Enhanced Development Commands

### Quality & Testing:

```bash
# Run all checks before suggesting a push
pnpm run lint && pnpm run type-check && pnpm run test

# Run tests for a specific file
pnpm test src/path/to/your/file.test.ts
```

### Browser Automation:

```bash
# Test messaging flow
node scripts/test/browser-automation-helper.mjs test-messages

# Test authentication flow
node scripts/test/browser-automation-helper.mjs test-auth

# Interactive browser session
node scripts/test/browser-automation-helper.mjs interactive

# With options
node scripts/test/browser-automation-helper.mjs test-messages --slow --screenshot
```

### Database:

```bash
# Reset the local Supabase DB to a clean state
pnpm exec supabase db reset

# Connect to the local Supabase DB
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres
```

## 🌐 Browser Automation for Claude

Claude has access to Playwright MCP tools for browser automation. Use these when:

1. **Testing UI fixes**: After fixing a frontend bug, verify it works in the browser
2. **Debugging issues**: When a user reports a UI problem, reproduce it via automation
3. **Demonstrating features**: Show the user how a feature works by automating the flow

### Example: Testing a Fix

**User**: "Messages aren't showing up"

**Claude's workflow**:

1. Fix the code issue
2. Use browser automation to verify:

   ```javascript
   // Navigate to messages
   await page.goto('http://localhost:3001/messages');
   await page.waitForSelector('[href*="/profiles/"]');

   // Click conversation
   await page.locator('[href*="/profiles/"]').first().click();
   await page.waitForTimeout(2000);

   // Verify messages load
   const messages = await page.locator('[data-testid="message"]').count();
   console.log(`Found ${messages} messages`);
   ```

3. Report results: "✅ Fixed and verified - messages now load correctly"

### Tips for Claude

- **Always wait**: Use `waitForSelector` before interacting with elements
- **Take screenshots**: Use `--screenshot` flag or `page.screenshot()` for debugging
- **Handle errors gracefully**: Wrap automation in try/catch, provide clear error messages
- **Use multiple selectors**: If one selector fails, try alternatives (text, role, data attributes)

---

## 🛠️ Actionable Project Notes

When working on these areas, consult the linked documents and use the specified code locations.

- **Timeline System:**
  - **Docs:** `docs/architecture/TIMELINE_ARCHITECTURE.md`
  - **Code:** Use services from `src/domain/timeline/`
- **Authentication & RLS:**
  - **Docs:** `docs/architecture/ARCHITECTURE.md` (Security section)
  - **Code:** Policies are in `supabase/migrations/`. Helpers in `src/lib/supabase/`.
- **Entity System:**
  - **Docs:** `docs/development/ENGINEERING_PRINCIPLES.md`
  - **Code:** The SSOT is `src/config/entity-registry.ts`. All entity-related code must use it.

---

## 🎓 Simple Git Glossary

For your reference, here are simple definitions for core Git terms.

- **Commit:** A local snapshot or "save point" of your changes.
- **Push:** Uploading your local commits to GitHub for backup and collaboration.
- **Branch:** A parallel version of the code, allowing you to work on features without affecting the main version.
- **Merge:** Combining changes from one branch into another.

---

**Last Updated:** 2026-01-03  
**Version:** 4.1  
**Purpose:** Guide Claude to be a proactive guardian of code quality and a strategic, first-principles-driven partner.

**Note:** For updates to common principles, best practices, or the handoff system, modify `docs/guides/ai/COMMON.md` instead of this file.
