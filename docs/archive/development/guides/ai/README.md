# AI Agent Guides - Modular Structure

**Last Updated:** 2026-01-03

---

## 🎯 Purpose

This directory contains guides for AI agents working on OrangeCat. The structure follows DRY and SSOT principles to ensure maintainability.

---

## 📁 File Structure

### Core Files

- **`COMMON.md`** ⭐ **SINGLE SOURCE OF TRUTH**
  - All shared content: principles, commands, workflows, best practices
  - **Edit this file to update ALL agents**
  - Contains: handoff system, quick reference, code style, etc.

- **`agents.md`**
  - Universal reference guide
  - Points to COMMON.md
  - Explains modular structure

### Claude Code Structure (New)

**Claude Code now uses a dedicated `.claude/` directory structure for maximum agentic efficiency:**

```
.claude/
├── CLAUDE.md                    # Main guide (auto-discovered)
├── QUICK_REFERENCE.md           # ⚡ One-page lookup (optimized for tokens)
├── CREDENTIALS.md               # 🔐 Tool access documentation
├── ERROR_RECOVERY.md            # 🚨 Common errors & fixes
├── RULES.md                     # 🛡️ Critical .env.local protection
├── rules/                       # Modular best practices (6 files)
├── hooks/                       # Automated guardrails (pre/post edit)
└── commands/                    # Custom commands (audit, deploy-check, etc.)
```

**Why this structure?**

- **80/20 Rule**: QUICK_REFERENCE.md covers 80% of needs in 500 lines vs 4000+ in detailed rules
- **Token Efficiency**: Saves ~3000 tokens per session start
- **Auto-Discovery**: Claude Code automatically finds `.claude/CLAUDE.md`
- **Tool Integration**: Clear documentation of MCP tool access and credentials

### Agent-Specific Files (Legacy)

- **`claude.md`** - Legacy Claude guide (deprecated - use `.claude/CLAUDE.md`)
- **`cursor.md`** - Cursor-specific inline assistance patterns
- **`gemini.md`** - Gemini-specific workflows
- **`codex.md`** - Codex CLI-specific patching patterns

**IMPORTANT**: Claude Code now uses `.claude/CLAUDE.md` as the primary guide. The `docs/guides/ai/claude.md` is maintained for backward compatibility but agents should use the `.claude/` directory structure.

**Each agent guide MUST read COMMON.md first.**

---

## 🔄 How to Update Commands/Principles

### To Add a New Command (e.g., `p` for pickup)

1. **Edit ONE file**: `docs/guides/ai/COMMON.md`
2. Add the command to the "Handoff System" section
3. Add it to the "Quick Reference" table
4. **Done!** All agents automatically get it.

**Example:**

```markdown
# In COMMON.md, add to Quick Reference:

| `p` or `pickup` | Read handoff and continue | Continue from last session |
```

### To Update Principles/Best Practices

1. **Edit ONE file**: `docs/guides/ai/COMMON.md`
2. Update the relevant section
3. **Done!** All agents automatically get the update.

### To Update Agent-Specific Behavior

1. Edit the specific agent file (e.g., `claude.md`)
2. Only that agent's behavior changes

---

## ✅ Modularity Benefits

**Before (Non-Modular):**

- Add command → Edit 5 files
- Update principle → Edit 5 files
- Update best practice → Edit 5 files

**After (Modular):**

- Add command → Edit 1 file (COMMON.md)
- Update principle → Edit 1 file (COMMON.md)
- Update best practice → Edit 1 file (COMMON.md)

---

## 📖 Reading Order for Agents

When an agent reads its guide:

1. **First**: Read `docs/guides/ai/COMMON.md` (all shared content)
2. **Second**: Read agent-specific guide (e.g., `docs/guides/ai/claude.md`)
3. **Result**: Full context with agent-specific patterns

---

## 🎯 Key Principle

**COMMON.md is the Single Source of Truth for all shared content.**

- All commands are defined in COMMON.md
- All principles are defined in COMMON.md
- All workflows are defined in COMMON.md
- **Browser automation patterns** are defined in COMMON.md
- Agent guides only contain what's unique to that agent

**To change anything shared: Edit COMMON.md only.**

## 🌐 Browser Automation

All agents have access to browser automation tools for testing and verification:

- **Helper Script**: `scripts/test/browser-automation-helper.mjs`
- **Playwright MCP**: Available via `mcp_playwright_browser_*` functions
- **Documentation**: See "Browser Automation & Testing" section in COMMON.md

---

## 📝 Maintenance Notes

- **Never duplicate content** from COMMON.md in agent-specific files
- **Always reference COMMON.md** in agent guides
- **Update COMMON.md** when adding shared functionality
- **Keep agent guides minimal** - only agent-specific content

---

**Remember**: The goal is modularity. One change in COMMON.md should update all agents automatically.
