# TypeScript Strict Mode Migration Strategy

**Created:** 2025-01-28  
**Last Modified:** 2025-01-28  
**Last Modified Summary:** Strategic approach for enabling strict mode based on top-tier engineering practices

---

## Executive Summary: What a Senior Engineer Would Do

**Short Answer:** A senior engineer at a top Silicon Valley firm would **NOT keep `strict: false` long-term**, but would use a **strategic, incremental migration approach** that allows the build to work while systematically improving type safety.

**Key Principles:**

1. **Never compromise on type safety for new code** - Set standards immediately
2. **Incremental migration** - Fix legacy code gradually, not all at once
3. **Pragmatic approach** - Keep builds working while improving
4. **Tooling & automation** - Use tools to help, not hinder
5. **Measure & track** - Know your progress, set targets

---

## The Reality: Why `strict: false` Exists

### Current Situation

- `strict: false` is enabled because enabling `strict: true` would break the build
- You have 66 remaining type safety issues
- Some legacy code patterns require gradual migration
- Build must continue working during migration

### This is Normal

**Even at top companies:**

- Google's codebase has legacy JavaScript being migrated to TypeScript
- Microsoft's TypeScript itself had gradual strict mode adoption
- Airbnb migrated from JavaScript to TypeScript over years
- **The key is having a plan, not perfection from day one**

---

## What Top-Tier Engineers Actually Do

### 1. **Incremental Strict Mode (Industry Standard)**

**The Strategy:** Enable strict mode **per-directory** or **per-file**, not globally.

```json
// tsconfig.json - Base config (allows legacy code)
{
  "compilerOptions": {
    "strict": false,  // Keep for now
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  }
}

// tsconfig.strict.json - For new code
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "strict": true  // Enable for new/modernized code
  },
  "include": [
    "src/components/**/*",
    "src/hooks/**/*",
    "src/lib/**/*"
  ]
}
```

**Then use project references:**

```json
{
  "files": [],
  "references": [{ "path": "./tsconfig.strict.json" }, { "path": "./tsconfig.json" }]
}
```

### 2. **Two-Track Approach (Google/Microsoft Pattern)**

**Track 1: New Code = Strict**

- All new files must pass strict mode
- New PRs cannot introduce `as any`
- Use separate `tsconfig.strict.json` for new code

**Track 2: Legacy Code = Gradual**

- Existing code can remain non-strict temporarily
- Migrate file-by-file when touching legacy code
- Set deadlines for complete migration (e.g., 6 months)

### 3. **Type Safety Gates (Airbnb Pattern)**

**In CI/CD Pipeline:**

```yaml
# .github/workflows/type-check.yml
- name: Type Check New Code
  run: |
    # Check only changed files with strict mode
    pnpm exec tsc --project tsconfig.strict.json --noEmit

- name: Type Safety Metrics
  run: |
    ISSUES=$(grep -r "as any\|@ts-ignore" src --include="*.ts" --include="*.tsx" | wc -l)
    echo "Current type safety issues: $ISSUES"
    # Fail if issues increase
```

### 4. **Automated Migration Tools**

**Use TypeScript's Built-in Fixes:**

```bash
# Auto-fix many type issues
pnpm exec tsc --noEmit --fix

# Use codemods for systematic changes
pnpm dlx jscodeshift -t transform.ts src/
```

**Generate Types Automatically:**

```bash
# Database types
pnpm exec supabase gen types typescript > src/types/database.ts

# API types
pnpm dlx openapi-typescript schema.json -o src/types/api.ts
```

### 5. **Pragmatic Standards (Meta/Netflix Pattern)**

**Immediate Standards (No Exceptions):**

- ✅ No new `as any` in PRs (reject PRs with them)
- ✅ All new functions must have return types
- ✅ All new interfaces must be properly typed
- ✅ Database queries must use generated types

**Gradual Standards (With Timeline):**

- ⏳ Legacy code: Fix when touched (boy scout rule)
- ⏳ Enable strict mode per directory (monthly goal)
- ⏳ Complete migration: 6-month target

---

## Recommended Migration Strategy

### Phase 1: Foundation (Week 1-2)

**1. Create Strict Config for New Code**

```json
// tsconfig.strict.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src/components/**/*", "src/hooks/**/*", "src/lib/**/*", "src/services/**/*"]
}
```

**2. Add ESLint Rules (Immediate)**

```json
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/ban-ts-comment": [
      "error",
      {
        "ts-ignore": "allow-with-description",
        "ts-expect-error": "allow-with-description"
      }
    ]
  }
}
```

**3. Update PR Template**

```markdown
## Type Safety

- [ ] No `as any` casts (new code only)
- [ ] All functions have return types
- [ ] Passes `tsc --project tsconfig.strict.json`
```

### Phase 2: Incremental Migration (Month 1-3)

**Strategy: "Boy Scout Rule"**

- When you touch a file, fix its type issues
- Migrate one directory at a time
- Enable strict mode per directory as you go

**Example Migration Order:**

1. ✅ `src/lib/` - Already mostly clean
2. ✅ `src/hooks/` - Already mostly clean
3. ⏳ `src/components/` - Fix as you touch files
4. ⏳ `src/app/api/` - Fix as you touch routes
5. ⏳ `src/services/` - Fix as you touch services

### Phase 3: Complete Migration (Month 4-6)

**Enable Strict Mode Globally:**

```json
{
  "compilerOptions": {
    "strict": true // Finally!
  }
}
```

**By this point:**

- All new code is strict
- Most legacy code is migrated
- Remaining issues are documented and scheduled

---

## Practical Implementation

### Option A: Per-Directory Strict Mode (Recommended)

**Structure:**

```
tsconfig.json              # Base (strict: false)
tsconfig.strict.json       # New code (strict: true)
src/
  components/              # Strict mode
  hooks/                   # Strict mode
  lib/                     # Strict mode
  legacy/                  # Non-strict (migrate gradually)
```

**Benefits:**

- ✅ Build continues working
- ✅ New code is type-safe
- ✅ Gradual migration possible
- ✅ No big-bang changes

### Option B: File-Level Overrides

**Use `// @ts-strict` comment:**

```typescript
// @ts-strict
// This file must pass strict mode checks
export function newFeature() {
  // Type-safe code here
}
```

**Then in tsconfig:**

```json
{
  "compilerOptions": {
    "strict": false,
    "plugins": [
      {
        "name": "typescript-strict-plugin"
      }
    ]
  }
}
```

### Option C: Hybrid Approach (Best of Both)

**1. Keep `strict: false` in base config**
**2. Create `tsconfig.strict.json` for new/modernized code**
**3. Use ESLint to enforce standards on new code**
**4. Migrate legacy code file-by-file**

---

## What NOT to Do (Common Mistakes)

### ❌ Don't: Enable Strict Mode Globally Overnight

```json
// ❌ BAD - Breaks build, blocks all development
{
  "strict": true // 1000+ errors, build fails
}
```

### ❌ Don't: Keep `strict: false` Forever

```json
// ❌ BAD - No type safety benefits
{
  "strict": false // Forever
}
```

### ❌ Don't: Allow New Code to Be Non-Strict

```typescript
// ❌ BAD - New code should be strict
function newFeature(data: any) {
  // Should be typed!
  return data.value;
}
```

### ✅ Do: Incremental, Measured Approach

```json
// ✅ GOOD - Strategic migration
{
  "strict": false // Legacy code
  // + tsconfig.strict.json for new code
  // + ESLint rules for enforcement
  // + Migration timeline
}
```

---

## Real-World Examples

### Google's Approach

- **New code:** Must pass strict mode
- **Legacy code:** Migrated when touched
- **Timeline:** 2-3 year migration for large codebases
- **Tooling:** Automated type generation, codemods

### Microsoft's Approach (TypeScript Team)

- **Incremental adoption:** Feature by feature
- **Backward compatibility:** Maintained during migration
- **Documentation:** Clear migration guides
- **Tooling:** Built migration tools

### Airbnb's Approach

- **Strict from day one:** New projects
- **Gradual migration:** Existing projects
- **Code review:** Reject PRs with type issues
- **Metrics:** Track type coverage

---

## Recommended Action Plan

### Immediate (This Week)

1. **Create `tsconfig.strict.json`**

   ```bash
   # New code must pass this
   pnpm exec tsc --project tsconfig.strict.json --noEmit
   ```

2. **Add ESLint Rules**
   - Block new `as any` in PRs
   - Require return types for new functions

3. **Update PR Template**
   - Type safety checklist
   - Require strict mode for new files

### Short-term (This Month)

1. **Fix Remaining 66 Issues**
   - Prioritize high-traffic files
   - Fix as you touch files (boy scout rule)

2. **Enable Strict Mode Per Directory**
   - Start with `src/lib/`
   - Then `src/hooks/`
   - Then `src/components/`

3. **Set Up CI/CD Checks**
   - Type check new code
   - Track type safety metrics
   - Block PRs that increase issues

### Long-term (3-6 Months)

1. **Complete Migration**
   - All directories in strict mode
   - Enable `strict: true` globally
   - Zero `as any` in codebase

2. **Maintain Standards**
   - Regular audits
   - Team training
   - Automated tooling

---

## Success Metrics

**Current State:**

- `strict: false` (build works)
- 66 type safety issues
- No enforcement for new code

**Target State (6 months):**

- `strict: true` globally
- < 10 type safety issues (only justified ones)
- 100% new code in strict mode
- Automated type generation
- Type safety in CI/CD

---

## The Bottom Line

**What a senior engineer would do:**

1. ✅ **Keep `strict: false` temporarily** - But with a plan
2. ✅ **Enable strict mode for new code immediately** - Via separate config
3. ✅ **Set standards for PRs** - No new `as any`
4. ✅ **Migrate incrementally** - File by file, directory by directory
5. ✅ **Use tooling** - Automated fixes, type generation
6. ✅ **Measure progress** - Track issues, set targets
7. ✅ **Complete migration in 6 months** - Not forever

**The key is:**

- **Pragmatic** - Don't break the build
- **Strategic** - Have a clear plan
- **Measured** - Track progress
- **Consistent** - Enforce standards for new code

---

_This strategy is based on practices from Google, Microsoft, Airbnb, Meta, and other top-tier engineering organizations._
