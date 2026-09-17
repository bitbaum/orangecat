# Claude Code Configuration

**Purpose**: Agentic, tool-driven development configuration for Claude Code

**Last Updated**: 2026-09-04

---

## 📁 Directory Structure

```
.claude/
├── CLAUDE.md                       # Main guide (auto-discovered)
├── README.md                       # This file
├── QUICK_REFERENCE.md              # ⚡ One-page lookup (READ FIRST)
├── CREDENTIALS.md                  # 🔐 Where credentials are & tool access
├── ERROR_RECOVERY.md               # 🚨 Common errors & fixes
├── RULES.md                        # 🛡️ Critical .env.local protection
├── rules/                          # Modular best practices (6 files)
│   ├── engineering-principles.md      # DRY, SSOT, core principles
│   ├── frontend-best-practices.md     # UI/UX, design system
│   ├── backend-best-practices.md      # API, database, Supabase
│   ├── architecture-patterns.md       # Factory, composition patterns
│   ├── code-quality.md                # Naming, testing, standards
│   └── domain-specific.md             # OrangeCat-specific rules
├── hooks/                          # Automated guardrails (2 scripts)
│   ├── pre-edit.sh                    # Prevent destructive changes
│   └── post-edit.sh                   # Self-correction after edits
└── commands/                       # Custom commands (3 scripts)
    ├── audit.sh                       # Comprehensive health check
    ├── db-check.sh                    # Database verification
    └── deploy-check.sh                # Pre-deployment checklist
```

---

## 🚀 Quick Start (Optimized Workflow)

### For Claude Code

Claude Code automatically discovers and loads `.claude/CLAUDE.md` at the project root.

### ⚡ Efficient Session Start (Recommended)

```bash
# 1. Initialize project structure
/init

# 2. Scan quick reference (500 lines vs 4000+ in detailed rules)
read_file(.claude/QUICK_REFERENCE.md)

# 3. Pickup from last session (if continuing work)
p

# Result: Full context in <1000 lines, ready to work
```

**Why This Works**:

- QUICK_REFERENCE.md covers 80% of common operations
- Detailed rules loaded on-demand (when needed)
- Saves ~3000 tokens per session start
- Faster response times

### Traditional Session Start (If Needed)

```bash
# Read everything (use only if working on new/unfamiliar area)
/init
read_file(.claude/CLAUDE.md)
read_file(.claude/rules/engineering-principles.md)
# ... etc
```

### Custom Commands

```bash
# Run comprehensive audit
/audit

# Check database health
/db-check

# Pre-deployment verification
/deploy-check
```

### Handoff System

```bash
# End of session - create handoff document
h
# or
handoff

# Start of session - pickup from last session
p
# or
pickup
```

---

## 🛡️ Automated Guardrails

### Pre-Edit Hooks

Runs **before** file edits to prevent mistakes:

- Blocks sensitive file edits (.env without backup)
- Warns about migration file changes
- Checks for protected files

### Post-Edit Hooks

Runs **after** file edits for self-correction:

- Type checking
- Linting (with auto-fix)
- Magic string detection
- File size warnings
- console.log detection

---

## 🎯 Core Principles

1. **DRY**: Don't Repeat Yourself
2. **SSOT**: Single Source of Truth (`entity-registry.ts`)
3. **Separation of Concerns**: domain/ → api/ → components/
4. **Type Safety**: TypeScript + Zod everywhere
5. **Modularity**: Configuration over code

---

## 🛠️ Tool Integration

### Supabase (Database)

Credentials in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://supabase.orangecat.ch
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

**Database access** (the Supabase MCP is retired):

- Reads: PostgREST over HTTPS (`$NEXT_PUBLIC_SUPABASE_URL/rest/v1/...` with the keys above)
- Migrations: files in `supabase/migrations/` — applied automatically on deploy
- DDL inspection: `ssh ubuntu@167.233.22.31 'docker exec supabase-db psql ...'`

### Browser Automation

**MCP Tools**:

- `mcp_cursor-ide-browser_browser_navigate()` - Navigate to page
- `mcp_cursor-ide-browser_browser_snapshot()` - Capture page state
- `mcp_cursor-ide-browser_browser_click()` - Click elements
- `mcp_cursor-ide-browser_browser_type()` - Fill forms

### Context7 (Documentation)

**MCP Tools**:

- `mcp_context7_resolve-library-id()` - Find library
- `mcp_context7_query-docs()` - Get documentation

---

## 📋 Modular Rules

All detailed best practices are in `.claude/rules/`:

- **Engineering Principles**: Core development principles (DRY, SSOT, etc.)
- **Frontend**: UI/UX patterns, design system compliance
- **Backend**: API design, database patterns, security
- **Architecture**: Factory patterns, composition, modularity
- **Code Quality**: Naming, testing, standards
- **Domain-Specific**: OrangeCat-specific rules (Bitcoin, actors, terminology)

---

## 🔄 Workflow Example

```bash
# 1. Start session
/init

# 2. User requests feature
"Add warranty field to products"

# 3. Claude workflow
- Reads entity-registry.ts (@file)
- Checks validation schemas
- Updates schema with Zod
- Adds a migration file in supabase/migrations/ (applied on deploy)
- Updates form config
- Post-hook runs (type-check, lint)
- Tests with browser automation
- Creates commit

# 4. End session
h  # Create handoff document
```

---

## 🎯 Success Metrics

### Code Quality

- Type safety: 100%
- Magic strings: 0
- Entity registry usage: 100%
- Test coverage: > 80%

### Performance

- First Contentful Paint: < 1.5s
- Time to Interactive: < 3s
- Bundle size: monitored

### Development Velocity

- New entity: < 1 hour
- Bug fixes: < 30 minutes
- Feature additions: hours, not days

---

## 📚 References

- **Main Guide**: `.claude/CLAUDE.md`
- **Common Patterns**: `docs/development/guides/ai/COMMON.md`
- **Engineering Principles**: `docs/development/ENGINEERING_PRINCIPLES.md`
- **Design System**: `docs/design-system/README.md`
- **Entity Registry**: `src/config/entity-registry.ts`

---

## 🔧 Maintenance

### Adding New Rules

1. Edit appropriate file in `.claude/rules/`
2. Keep modular (one concern per file)
3. Include examples (good ✅ and bad ❌)
4. Update this README if structure changes

### Adding New Commands

1. Create script in `.claude/commands/`
2. Make executable: `chmod +x .claude/commands/new-command.sh`
3. Document in CLAUDE.md
4. Test thoroughly

### Adding New Hooks

1. Create script in `.claude/hooks/`
2. Make executable: `chmod +x .claude/hooks/new-hook.sh`
3. Test with sample edits
4. Document behavior

---

## 🎓 Philosophy

**Claude is**:

- **Agentic**: Uses tools autonomously, chains operations
- **Guardian**: Enforces principles, prevents tech debt
- **Tool-driven**: Supabase MCP, browser automation, Context7
- **Self-correcting**: Hooks catch errors, Claude fixes immediately
- **Collaborative**: Handoff system for multi-agent work

**Mission**: Build powerful, maintainable, user-friendly software through intelligent automation and principled engineering.

---

**Version**: 5.0  
**Status**: Production-ready  
**Next Review**: When new tools or patterns emerge
