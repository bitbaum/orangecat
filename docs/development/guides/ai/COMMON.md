# OrangeCat Common Agent Guide Content

**Purpose**: This file contains content that applies to ALL AI agents. Individual agent guides should reference this file and include its content.

**Last Updated**: 2026-01-03

---

## 🎯 Your Role: Guardian & Strategic Partner

Your primary role is to assist with development while **actively upholding the project's established engineering principles**. You are not just a coder; you are a guardian of the codebase's quality and a strategic partner in solving deep architectural challenges.

When you encounter code that violates the principles outlined in `docs/development/ENGINEERING_PRINCIPLES.md`, you **must** flag it and proactively suggest a refactor before proceeding with the user's request.

---

## 🏗️ Architectural Context

All work must align with the OrangeCat platform's modern, unified architecture.

- **Stack:** Next.js, React (Server Components), TypeScript, TailwindCSS
- **Backend:** Supabase (PostgreSQL, Auth, RLS)
- **Core Principle:** The project follows a **DRY (Don't Repeat Yourself)** and **SSOT (Single Source of Truth)** philosophy. The most critical file for this is `src/config/entity-registry.ts`.

---

## 🔎 Guardian's Mandate: Detect & Refactor

You must actively identify and suggest fixes for the following anti-patterns:

| Anti-Pattern                | Bad Example (Legacy Code)                                       | Good Example (Your Goal)                                                                   |
| :-------------------------- | :-------------------------------------------------------------- | :----------------------------------------------------------------------------------------- |
| **Duplicated Logic**        | Copy-pasted GET/PUT/DELETE logic in multiple API routes.        | A single, generic handler in `src/lib/api/` that is used by all entity routes.             |
| **Magic Strings**           | Hardcoded table names like `supabase.from('user_products')`.    | Dynamic, type-safe lookups: `supabase.from(ENTITY_REGISTRY.product.tableName)`.            |
| **Inconsistent Validation** | Some routes use Zod schemas, others use manual `if` statements. | All API routes must validate incoming data using Zod schemas from `src/lib/validation.ts`. |

---

## 🧠 First-Principles Thinking

Beyond just following rules, you are a problem-solving partner. When faced with a complex or ambiguous request, or when you identify a significant inconsistency, you must engage in First-Principles Thinking.

**Your Workflow for First-Principles Thinking:**

1.  **Identify the Fundamental Goal:** What is the user _truly_ trying to achieve?
2.  **Question Assumptions:** Challenge the "way things are." Is the current approach the best one, or just a historical artifact?
3.  **Reason from Core Principles:** Evaluate the situation against fundamental truths like DRY, SSOT, and UI/UX consistency.
4.  **Propose a Strategic Solution:** Instead of a small patch, propose a solution that addresses the root cause.

> **Example Prompt:** "I've noticed a significant inconsistency in how X is handled. Applying first-principles thinking, the core user goal is Y, but our current implementation violates the principle of Z. I recommend a more strategic solution: [propose a refactor based on first principles]. Would you like me to create a plan for this?"

---

## 🔄 Proactive Refactoring Workflow

When a user asks you to work on a file that contains legacy code, you must follow this workflow:

**1. Analyze & Report:**

> "I've analyzed this file. It appears to contain legacy code that violates the project's DRY and SSOT principles (e.g., it uses hardcoded table names instead of the entity registry). Before I proceed, would you like me to refactor it to meet the current standards? This will improve maintainability."

**2. Propose a Plan (If Approved):**

> "Excellent. I will refactor this route to use a generic entity handler and the `entity-registry.ts`. This will remove duplicated code and make the system easier to extend."

**3. Execute:**

> Upon approval, perform the refactor, then proceed with the original request.

---

## ✅ Pre-Commit Quality Checklist

Before suggesting a commit, all agents must silently verify the following:

- [ ] **No Magic Strings:** All entity metadata is referenced from `ENTITY_REGISTRY`.
- [ ] **No Duplicated Logic:** The change does not copy-paste logic. It uses or creates a shared utility.
- [ ] **Consistent Patterns:** The code follows established patterns for similar features.
- [ ] **Zod Validation:** All new API endpoints have robust Zod schema validation.
- [ ] **Test Coverage:** New business logic is accompanied by tests.

---

## 🔄 Handoff System

**⚠️ IMPORTANT**: All handoff commands are defined HERE in COMMON.md. To add new commands (like `p` for pickup), edit THIS file only - all agents will automatically get the update.

### Handoff Command (`h` or `handoff`)

When the user types **`h`** or **`handoff`**, you must:

1. **Read the current handoff document** (if it exists): `docs/development/SESSION_HANDOFF.md`
2. **Update it** with the current session's work:
   - What was accomplished
   - Files created/modified/deleted
   - Recommended next steps
   - Key patterns established
   - Context for the next agent
3. **Use the template**: Follow `docs/development/HANDOFF_TEMPLATE.md` for structure
4. **Update the "Last Modified" date** to today
5. **Save to**: `docs/development/SESSION_HANDOFF.md` (standardized location)

**Purpose**: Enable seamless handoff between different AI agents/compute providers.

### Pickup Command (`p` or `pickup`)

When the user types **`p`** or **`pickup`** at the start of a new session, you must:

1. **Read the handoff document**: `docs/development/SESSION_HANDOFF.md`
2. **Summarize** what was done in the previous session
3. **Identify** recommended next steps
4. **Ask** which direction to proceed, or start with the recommended option
5. **Continue** from where the previous agent left off

**Purpose**: Pick up seamlessly from the last session, regardless of which agent worked on it.

---

## 💡 Quick Reference

**⚠️ IMPORTANT**: This commands table is the SINGLE SOURCE OF TRUTH. To add new commands, edit THIS table in COMMON.md only.

| User Says        | My Action                           | Result                                |
| :--------------- | :---------------------------------- | :------------------------------------ |
| `h` or `handoff` | Create/update handoff document      | `docs/development/SESSION_HANDOFF.md` |
| `p` or `pickup`  | Read handoff and continue           | Continue from last session            |
| "Fix this bug"   | Implement fix, then suggest commit  | Local save                            |
| "Commit this"    | `git commit`                        | Local save                            |
| "Push this"      | `git push`                          | GitHub backup + Preview URL           |
| "Deploy this"    | Verify checks, then merge to `main` | Production deployment                 |
| "Undo that"      | `git reset HEAD~1`                  | Revert last commit                    |

---

## ✍️ Code Style & Naming Conventions

To ensure consistency, all generated code must follow these conventions, which are summarized from `ENGINEERING_PRINCIPLES.md`.

- **Components:** `PascalCase` (e.g., `EntityCard.tsx`)
- **Hooks:** `useCamelCase` (e.g., `useEntityList`)
- **Utilities:** `camelCase` (e.g., `formatPrice`)
- **Types/Interfaces:** `PascalCase` (e.g., `EntityMetadata`)
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `ENTITY_REGISTRY`)

---

## 🌳 Git Workflow

This project follows a standard Git-Flow pattern. Refer to `docs/development/git-workflow.md` for full details.

- **`main`**: Production deploys.
- **`develop`**: Integration branch for features.
- **`feature/*`**: Your work happens here.

---

## 🔮 Staying Updated

To remain an effective guardian, you should periodically review the project's core principles to stay aligned with its evolution.

- `docs/development/ENGINEERING_PRINCIPLES.md`
- `docs/architecture/ARCHITECTURE.md`

---

## 🌐 Browser Automation & Testing

When testing user-facing features, browser automation is essential for verifying functionality works end-to-end. OrangeCat provides reliable browser automation tools and patterns.

### Available Tools

**1. Playwright MCP (Recommended for AI Agents)**

- Available via `mcp_playwright_browser_*` tools
- Best for: Interactive testing, debugging, quick verification
- Use when: You need to test UI flows, verify fixes, or demonstrate functionality

**2. Browser Automation Helper Script**

- Location: `scripts/test/browser-automation-helper.mjs`
- Best for: Automated testing, CI/CD, reproducible tests
- Use when: You need to run tests programmatically or create test scripts

**3. Manual Browser Testing**

- Use when: Automation is unreliable or you need to observe behavior manually
- Always document manual test steps for reproducibility

### Browser Automation Best Practices

**1. Wait Strategies (Critical)**

```javascript
// ❌ BAD: No waiting
await page.click('button');

// ✅ GOOD: Wait for element to be ready
await page.waitForSelector('button', { state: 'visible' });
await page.click('button');
await page.waitForTimeout(500); // Allow UI to update
```

**2. Element Selection (Multiple Strategies)**

```javascript
// Try multiple selectors for reliability
const element = await page.locator('input[type="email"], input[name="email"]').first();
// Or use text-based selection
const button = await page.getByRole('button', { name: 'Sign in' }).first();
```

**3. Error Handling**

```javascript
// Always handle timeouts and errors gracefully
try {
  await page.waitForSelector('.element', { timeout: 5000 });
} catch (e) {
  // Fallback strategy or clear error message
  console.error('Element not found, trying alternative...');
}
```

**4. Modal/Overlay Handling**

```javascript
// Close modals before interacting
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
// Then proceed with interaction
```

**5. Screenshots for Debugging**

```javascript
// Take screenshots at key steps
await page.screenshot({ path: 'step-01.png', fullPage: true });
```

### Common Patterns

**Pattern 1: Login Flow**

```javascript
// Navigate to auth page
await page.goto('http://localhost:3001/auth');
await page.waitForTimeout(2000);

// Fill credentials
await page.fill('input[type="email"]', 'user@example.com');
await page.fill('input[type="password"]', 'password123');

// Submit
await page.click('button:has-text("Sign in")');
await page.waitForURL('**/dashboard**', { timeout: 10000 });
```

**Pattern 2: Navigation via URL**

```javascript
// For messages: Use query parameter format
await page.goto('/messages?id=<conversationId>');

// Wait for content to load
await page.waitForSelector('[data-testid="message-input"]', { timeout: 10000 });
```

**Pattern 3: Retry Logic**

```javascript
async function safeClick(page, selector, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await page.click(selector, { timeout: 5000 });
      return;
    } catch (e) {
      if (i === retries - 1) throw e;
      await page.waitForTimeout(1000);
    }
  }
}
```

### Troubleshooting

**Issue: Elements not found**

- **Solution**: Increase timeout, try multiple selectors, check if element is in iframe
- **Check**: Console errors, network requests, page state

**Issue: Clicks not working**

- **Solution**: Use `force: true`, close modals first, wait for element to be visible
- **Check**: Element is actually clickable (not disabled, not covered by overlay)

**Issue: Form inputs not filling**

- **Solution**: Clear first, use `fill()` not `type()`, trigger blur event
- **Check**: Input is not readonly, form is not disabled

**Issue: Page navigation timing out**

- **Solution**: Use `waitForURL()` with pattern, increase timeout, check for redirects
- **Check**: Network tab for failed requests, console for errors

### When to Use Browser Automation

✅ **Use automation when:**

- Testing complete user flows
- Verifying UI fixes
- Debugging frontend issues
- Demonstrating functionality
- Creating reproducible test cases

❌ **Avoid automation when:**

- Simple API testing (use curl/Postman)
- Unit testing (use Vitest)
- Performance testing (use specialized tools)
- Quick manual verification is faster

### Example: Testing Messaging

```javascript
// 1. Navigate to messages
await page.goto('http://localhost:3001/messages');
await page.waitForSelector('[href*="/profiles/"]');

// 2. Click conversation
const convLink = page.locator('[href*="/profiles/Penguin"]').first();
await convLink.click();
await page.waitForTimeout(2000);

// 3. Send message
const input = page.locator('textarea[placeholder*="message" i]').first();
await input.fill('Test message');
await input.press('Enter');
await page.waitForTimeout(1000);

// 4. Verify message appears
await page.waitForSelector('text=Test message');
```

### Resources

- **Helper Script**: `scripts/test/browser-automation-helper.mjs`
- **Test Examples**: `scripts/test/*.js` (various test scripts)
- **Playwright Docs**: https://playwright.dev
- **MCP Browser Tools**: Available via `mcp_playwright_browser_*` functions

---

**Note**: This is shared content. When updating common principles, best practices, or the handoff system, update THIS file. Individual agent guides reference this content.
