# AGENTS.md - Orange Cat Multi-Agent Development

## 🤖 Available AI Agents

### **Cursor Models (Primary IDE)**

- **Code-Supernova-1-Million** - 1M context, complex architecture
- **Grok Code** - Real-time knowledge, quick fixes
- **Claude Code** - TypeScript/backend expertise
- **Other Models** - Latest GPT models, etc.

### **Agent Selection Guide**

- **Complex Architecture & ML Models** → Code-Supernova-1-Million
- **TypeScript/Node.js/API Work** → Claude Code
- **Quick Fixes & Research** → Grok Code
- **Frontend/React Development** → Latest GPT or Claude Code

### **Coordination Commands**

- `make ho MESSAGE="handoff message"` - Quick handoff
- `make model-select TASK="task description"` - Get model recommendation
- `make claim AGENT=model AREA="area" SUMMARY="summary" ETA="30m"` - Claim task
- `bash scripts/smoke.sh` - Health checks (customize for Orange Cat)

## 📚 AI Agent Guides

**All AI agents working on this codebase should read the guides in `docs/guides/ai/`:**

- **[COMMON.md](./ai/COMMON.md)** ⭐ **START HERE** - Single source of truth for all shared principles, commands, and workflows
- **[README.md](./ai/README.md)** - Guide structure and how to update
- **[claude.md](./ai/claude.md)** - Claude-specific workflows
- **[cursor.md](./ai/cursor.md)** - Cursor-specific patterns
- **[agents.md](./ai/agents.md)** - Universal agent reference

**Key Principle:** All shared content is in `COMMON.md`. Agent-specific files only contain unique content.

## Orange Cat Project Overview

Bitcoin-powered crowdfunding platform built for transparency and impact with native Bitcoin and Lightning Network support.

## Contributing With AI Agents

- Use Cursor's "Apply" feature to implement changes
- Models auto-detect project structure
- Update TASK_QUEUE.md when claiming/completing tasks
- Log all activities in AGENTS_SYNC.md

## Protected Files Policy

- Never delete or overwrite local environment files: `.env.local` and the `.env-backups/` directory.
- Always use `node scripts/utils/env-manager.js backup` before any change to env files, and `restore` to recover.
- Do not run commands that recreate `.env.local` if it already exists. Prefer `validate` or `setup` via Env Manager.
- CI/agents must not modify developer-local env files; only read them. Production env lives in `/opt/orangecat/app/.env` on the Hetzner box, managed there — not in any local file.
- If an automation suggests copying `.env.example` over `.env.local`, reject it and use the Env Manager instead.
