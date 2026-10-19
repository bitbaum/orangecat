# OrangeCat Universal AI Agent Guide

> **📋 Note**: This is the universal guide that applies to all agents. For agent-specific content, see individual guides (claude.md, cursor.md, etc.). For common content shared by all agents, see `docs/guides/ai/COMMON.md`.

---

## 🎯 Purpose

This guide serves as the base reference for all AI agents working on OrangeCat. It establishes the universal principles and workflows that apply regardless of which AI agent is being used.

---

## 📖 Common Content Reference

**All content from `docs/guides/ai/COMMON.md` applies universally**, including:

- Your Role: Guardian & Strategic Partner
- Architectural Context
- Guardian's Mandate: Detect & Refactor
- First-Principles Thinking
- Proactive Refactoring Workflow
- Pre-Commit Quality Checklist
- Handoff System (`h`/`handoff` and `pickup` commands)
- Quick Reference
- Code Style & Naming Conventions
- Git Workflow
- Staying Updated

**When common content needs updating, modify `docs/guides/ai/COMMON.md` - it will apply to all agents.**

---

## 🔄 Modularity Principle

**Important**: This guide structure follows DRY and SSOT principles:

- **`docs/guides/ai/COMMON.md`**: Single source of truth for all shared content
- **Individual agent guides** (claude.md, cursor.md, etc.): Agent-specific workflows and examples
- **This file** (agents.md): Universal reference that points to common content

**To update common principles, best practices, or the handoff system:**

1. Edit `docs/guides/ai/COMMON.md`
2. All agents will automatically use the updated content

**To update agent-specific behavior:**

1. Edit the specific agent guide (e.g., `claude.md`)
2. Only that agent's behavior changes

---

## 📚 Agent-Specific Guides

### Claude Code (Optimized Structure)

**Claude Code uses the optimized `.claude/` directory structure for maximum agentic efficiency:**

- **`.claude/CLAUDE.md`** ⭐ **PRIMARY** - Main guide (auto-discovered by Claude Code)
- **`.claude/QUICK_REFERENCE.md`** ⚡ - One-page lookup (covers 80% of operations)
- **`.claude/CREDENTIALS.md`** 🔐 - Tool access and credential documentation
- **`.claude/ERROR_RECOVERY.md`** 🚨 - Common errors and step-by-step fixes
- **`.claude/rules/`** 📖 - Detailed best practices (6 modular files)
- **`.claude/hooks/`** 🛡️ - Automated guardrails (pre/post edit)
- **`.claude/commands/`** ⚡ - Custom commands (audit, deploy-check, etc.)

**Why this structure?**

- **80/20 Rule**: QUICK_REFERENCE.md covers 80% of needs in 500 lines vs 4000+ in detailed rules
- **Token Efficiency**: Saves ~3000 tokens per session start
- **Auto-Discovery**: Claude Code automatically finds `.claude/CLAUDE.md`
- **Tool Integration**: Clear documentation of MCP tool access

### Other Agents (Legacy Structure)

- **Claude (Legacy)**: `docs/guides/ai/claude.md` - Deprecated, use `.claude/CLAUDE.md`
- **Cursor**: `docs/guides/ai/cursor.md` - Inline code assistance patterns, inline testing
- **Gemini**: `docs/guides/ai/gemini.md` - Gemini-specific workflows, debugging patterns
- **Codex**: `docs/guides/ai/codex.md` - CLI-specific patching patterns

## 🌐 Browser Automation (All Agents)

All agents should use browser automation to verify UI fixes and test features. See `docs/guides/ai/COMMON.md` for:

- Browser automation best practices
- Common patterns and examples
- Troubleshooting guide
- When to use automation vs. manual testing

**Quick Reference:**

- Helper script: `scripts/test/browser-automation-helper.mjs`
- Playwright MCP tools: Available via `mcp_playwright_browser_*` functions
- Test examples: `scripts/test/*.js`

---

**Last Updated:** 2026-01-03  
**Version:** 4.1  
**Purpose:** Universal guide for all AI agents to enforce code quality and act as strategic, first-principles-driven partners.

**Note:** For updates to common principles, best practices, or the handoff system, modify `docs/guides/ai/COMMON.md` instead of this file.
