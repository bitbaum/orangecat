# OrangeCat Development Guide for Codex CLI

> **⚠️ CRITICAL: You MUST read `docs/guides/ai/COMMON.md` FIRST before reading this file.**
>
> **All commands, principles, and workflows are defined in COMMON.md. This file only contains Codex-specific examples and workflows.**

---

## 🎯 Agent-Specific Context

This guide is tailored for Codex CLI.

**IMPORTANT**: All commands (including `h`, `handoff`, `pickup`, etc.), principles, best practices, and workflows are defined in `docs/guides/ai/COMMON.md`. You must read that file first to understand the full context.

**This file only contains Codex-specific content** - CLI-specific patching patterns and Codex workflows.

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

## 🤖 Guardian Behavior in Codex CLI

Your core workflow combines surgical patching with the Guardian's Mandate and First-Principles Thinking.

**1. Plan:** Maintain a concise plan with clear steps.

**2. Analyze First:** Before creating a patch, analyze the target files for legacy patterns or deeper architectural inconsistencies.

**3. Think & Report:** If you find anti-patterns or deeper issues, state your intention to solve the root cause first.

> "I've analyzed the target files and found legacy code that violates our DRY principle. My first step will be to create a patch to refactor this before implementing the feature."
> **OR**
> "I've noticed a deeper inconsistency here. Applying first-principles thinking, I recommend a more strategic solution... My plan will be to first [propose strategic refactor], then [implement feature]."

**4. Create Surgical Patches:** Use `apply_patch` to implement changes. Create separate, focused patches for refactoring and feature implementation.

**5. Run Targeted Checks:** After applying a patch, run narrow-scoped checks on the changed areas.

---

## 🔧 Commands

### Local Checks

```bash
# Run targeted checks on changed files
pnpm run type-check
pnpm test src/path/to/changed/file.test.ts
```

### Browser Automation

```bash
# Test UI changes after patching
node scripts/test/browser-automation-helper.mjs test-messages --screenshot

# Quick verification
node scripts/test/browser-automation-helper.mjs test-auth
```

### Full Suites (Pre-Push/Deploy)

```bash
pnpm run lint && pnpm run test
```

## 🌐 Browser Automation for Codex

After applying patches that affect UI, verify them work:

### Pattern: Patch + Verify

1. **Apply patch** to fix UI issue
2. **Run browser test** to verify:
   ```bash
   node scripts/test/browser-automation-helper.mjs test-messages --screenshot
   ```
3. **Review screenshots** in `browser-screenshots/` folder
4. **Report results**: "✅ Patch applied and verified - messages now load correctly"

---

## 📌 Tips for High-Quality Changes

- **Think First:** When you encounter legacy patterns or inconsistencies, address the root cause.
- **Refactor First:** Apply a separate, focused patch to refactor legacy code _before_ adding new features.
- **Surgical Patches:** Keep diffs focused and minimal.
- **Update Docs:** If your change affects behavior, update adjacent documentation.

---

**Last Updated:** 2026-01-03  
**Version:** 4.1  
**Purpose:** Guide Codex CLI to be a proactive, first-principles-driven partner, tailored to its specific environment.

**Note:** For updates to common principles, best practices, or the handoff system, modify `docs/guides/ai/COMMON.md` instead of this file.
