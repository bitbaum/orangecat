# UX/UI audit 2026-11-12 — Sign-in, sign-up and the first five minutes

The open findings for this area from [the audit](2026-11-12-ux-ui-audit.md), each with its cause and the fix a second reviewer checked. File and line references are as of commit `0275875` (2026-11-12); locate by content.

### auth-firstrun#0 · high · Sign-in shows two orange primaries, and the first one creates a new account

**Status:** Fixed (fourth pull request).

- **Where:** /auth, /auth?mode=register, https://orangecat.ch/auth (both, both themes)
- **What a person meets:** Login is the default mode and every protected page redirects to /auth?mode=login&from=..., so a returning person meets a larger, earlier orange button that silently creates a second, empty account and carries them to their destination as a stranger: their projects and wallet look gone. A new person gets two equal primaries and has to work out which one is the way in. Pressing 'Start instantly' gives no feedback …
- **Cause:** src/app/auth/AuthPageClient.tsx:187-204 and :196; src/app/auth/AuthFormBody.tsx:169-173; src/app/auth/EmailCodeSignIn.tsx:208-212 and :268-272; src/app/auth/useAuthForm.ts:208-229
- **Fix:** Keep 'Start instantly — no email' as the ONE accent wherever it is shown; every other submit is monochrome. (1) AuthFormBody: new prop `submitVariant: 'accent' | 'primary'`, line 172 `variant={submitVariant}`. AuthPageClient passes `submitVariant={clientName && mode !== 'forgot' ? 'accent' : 'primary'}` (accent only when another app sent the person and the anonymous block is hidden; never in forgot mode). (2) EmailCodeSignIn.tsx:210 and :270 take the same prop, default 'primary'. (3) Say the consequence in login mode, AuthPageClient.tsx:205-207: `mode === 'login' ? 'New here? This starts a fresh account with no email. Already have one? Sign in below.' : 'Explore pseudonymously. Add an email anytime to secure your account.'`, class `text-fg-secondary` (see finding 4). (4) useAuthForm: `const [anonLoading, setAnonLoading] = useState(false)`, true before signInAnonymously(), false in the …
- **Mind:** The original fix contradicts the documented anonymous-first decision and breaks the live rehearsal locator. The refined fix has none; `disabled:opacity-100` keeps the accent from ever showing as a washed-out slab.

### auth-firstrun#1 · high · A new person's first screen depends on which button they used; the lead button leads to the weakest one

**Status:** Fixed (fourth pull request).

- **Where:** /auth, /dashboard, /dashboard/cat?welcome=true, /onboarding/intelligent (both, both themes)
- **What a person meets:** Three different first screens for the same new person. Whoever pressed the lead button gets the dashboard and a checklist nagging for the name that the onboarding screen would have asked for in one field. They only meet that screen by accident: tapping the logo throws them into a form with a 'Back' button, which feels like a bug.
- **Cause:** src/app/auth/useAuthForm.ts:142-145 and :217-219; src/hooks/useAuthRedirects.ts:154; src/lib/oauth/handoff.ts:71; src/app/auth/callback/route.ts:11-15; src/app/auth/confirm/route.ts:12-17; src/app/page.tsx:46
- **Fix:** One constant, used by every way in. (1) src/config/routes.ts, after ROUTES: `export const AFTER_SIGN_IN = ROUTES.DASHBOARD.CAT_WELCOME;`. (2) useAuthForm.ts:142-145 and :217-219 become `const redirectUrl = safeReturnPath(searchParams?.get('from')) ?? AFTER_SIGN_IN;` (safeReturnPath is already imported). (3) useAuthRedirects.ts:154 `?? AFTER_SIGN_IN`; handoff.ts:71 the same; callback/route.ts and confirm/route.ts use AFTER_SIGN_IN in place of ROUTES.DASHBOARD.CAT_WELCOME. (4) **tests**/unit/hooks/useRedirectIfAuthenticated.test.tsx:46 and :52 expect '/dashboard/cat?welcome=true'. (5) src/app/page.tsx:46 `redirect(ROUTES.DASHBOARD.CAT_WELCOME)` and rewrite the comment at 43-45; onboarded people keep DASHBOARD.CAT at line 53. (6) Keep the name form reachable on purpose: in EmptyState.tsx, when `isNewUser`, add one row to the existing `&lt;nav aria-label="Open a page">`: `&lt;Link …
- **Mind:** None. Note the behaviour change: password, emailed-code and anonymous sign-ins with no `from` now open on the Cat instead of the dashboard (tests/e2e/helpers/login.ts:16 already accepts 'cat'). `?welcome=true` then greets returning people as new; see missed item 4.

### auth-firstrun#2 · medium · Onboarding: the main field is 241px wide in a 308/462px column and unlabelled; examples are cut mid-word

**Status:** Fixed (fourth pull request).

- **Where:** /onboarding/intelligent (both, both themes)
- **What a person meets:** The only dedicated onboarding screen looks unfinished at every width and in both themes. The field where a person describes themselves is the smallest thing in the form, the examples cannot be read before tapping them, and a screen-reader user gets an unnamed text box.
- **Cause:** src/components/onboarding/IntelligentOnboarding.tsx:214-239: the Textarea is a child of `flex items-start gap-2`, but Textarea wraps itself in &lt;div className="space-y-2"> (src/components/ui/Textarea.tsx:20), which is not flex-1, so `w-full` resolves against a box shrink-wrapped to the browser's default 20 columns. The label at line 214 is a bare &lt;label> with no htmlFor. Line 253 slices every example to 50 characters; line 246 lays them out as a wrapping pill box.
- **Fix:** Replace IntelligentOnboarding.tsx:214-239 with chatkit's field, themed the way ChatInput.tsx:59 does: `&lt;div className="[--ck-accent:hsl(var(--text-primary))] [--ck-on-accent:hsl(var(--text-inverted))]" onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void handleSeeOffers(); }}>&lt;DictationField id="onboarding-description" label="Who are you? What do you do?" value={description} onValueChange={setDescription} placeholder="e.g. Senior product designer, 10 years, ex-fintech. I also restore vintage bikes on weekends…" rows={4} voice={CHAT_VOICE} />&lt;/div>`. Imports: `DictationField` from '@bitbaum/chatkit/react', '@bitbaum/chatkit/styles.css', `CHAT_VOICE` from '@/hooks/useDictation'; drop Textarea, DictationButton and FEATURES. Change the selector in cypress/e2e/onboarding.cy.ts:7 and tests/e2e/test-intelligent-onboarding.mjs:63 to `#onboarding-description` …
- **Mind:** None. This is the first DictationField in the repo, so look at it in both themes at 390 before shipping.

### auth-firstrun#3 · medium · First-run dashboard copy talks to someone who already has things

**Status:** Fixed (fourth pull request).

- **Where:** /dashboard (both, both themes)
- **What a person meets:** The first sentence a new person reads is about a concept they have not met. The progress figure is false, so the checklist loses credibility. The feed reads as somebody's server log presented as their own activity. The strongest button asks them to share an empty, hex-named profile. None of it points at the one thing to do, the composer above.
- **Cause:** src/components/dashboard/sections/DashboardHeader.tsx:77; src/services/recommendations/index.ts:167-179 shown at src/components/dashboard/TasksSection.tsx:223 and :244-249; src/components/dashboard/DashboardTimeline.tsx:40; src/components/dashboard/sections/DashboardInviteCTA.tsx:36-43
- **Fix:** (1) DashboardHeader.tsx:77: render the status `&lt;p>` only when `!(name === null && waiting === 0 && totalDrafts === 0)`; leave dashboardStatusLine and its test alone. (2) TasksSection.tsx: delete the `{taskCompletion}% Setup` line (223) and the progress bar (244-249), keep the remaining count as `&lt;div className="text-sm text-fg-secondary">`, and drop `taskCompletion` from the destructuring at line 78 (fewer lines; the file is 290/300). (3) DashboardTimeline.tsx:40 title 'Latest on OrangeCat'; line 46 aria-label and line 53 text to match. (4) DashboardInviteCTA.tsx: `if (isMintedHandle(profile?.username)) return null;` (import from '@/config/usernames'), and the button becomes `&lt;Button variant="outline" size="sm" className="min-h-11 shrink-0">` without the bg-fg-primary override.

### auth-firstrun#4 · medium · Small grey text fails AA in both themes; light-theme dividers are struck through by their own line

**Status:** Fixed (fourth pull request).

Status: Partly (#1634): contrast; the divider line is open.

- **Where:** /auth, /auth?mode=register, /onboarding/intelligent, /what-you-can-do (both, both themes)
- **What a person meets:** The sentence that explains what the lead button does, and the concrete example on every capability card, are the hardest text on the page to read. In light theme the dividers look like struck-out text, which reads as broken.
- **Cause:** src/app/globals.css:231 (--text-tertiary: 0 0% 58%, light) and :329 (0 0% 48%, dark) cannot reach 4.5:1 on the page surfaces, yet text-fg-tertiary / text-fg-muted carry content at 12-14px: src/app/auth/AuthPageClient.tsx:205 and :213, src/app/auth/AuthSocialLogin.tsx:56, src/components/onboarding/IntelligentOnboarding.tsx:243, src/components/map/CapabilityMap.tsx:29-30. The strike-through: the divider label is masked with bg-surface-raised/40, which is 40% opaque in light (AuthPageClient.tsx:213, …
- **Fix:** Use `text-fg-secondary` (light #666 on #f7f7f7 = 5.36:1, on #fff = 5.74:1; dark #a6a6a6 on #121212 = 7.69:1, on #1c1c1c = 7.0:1) at AuthPageClient.tsx:205, EmailCodeSignIn.tsx:195, IntelligentOnboarding.tsx:243, OnboardingOffers.tsx:64, CapabilityMap.tsx:29 and :36, and remove `text-fg-muted` from the 'For example:' span at CapabilityMap.tsx:30. Divider: one small `AuthDivider` in src/app/auth used at AuthPageClient.tsx:208-217 and AuthSocialLogin.tsx:51-60: `&lt;div className="flex items-center gap-3">&lt;span aria-hidden="true" className="flex-1 border-t border-default" />&lt;span className="text-xs uppercase tracking-wider text-fg-secondary">{children}&lt;/span>&lt;span aria-hidden="true" className="flex-1 border-t border-default" />&lt;/div>`. Replace `bg-surface-raised/40 dark:bg-surface-page` with `bg-surface-page` at AuthPageClient.tsx:88, :98 and :101. Leave the --text-tertiary …

### auth-firstrun#6 · medium · Setup checklist: three rows open the same form, the best row is hidden, row titles outrank the card title

**Status:** Fixed (fourth pull request).

- **Where:** /dashboard (both, both themes)
- **What a person meets:** One form and one conversation are presented as four chores. The fastest option, the one that does all of it, is hidden. On desktop the hierarchy is inverted, and the card pushes the person's own content below the fold.
- **Cause:** src/services/recommendations/tasks.ts:99, :135 and :145 define three separate high-priority tasks with the same action href; :157 'chat-with-cat' has the same priority and sorts last. src/components/dashboard/sections/DashboardJourney.tsx:22 shows two. src/components/dashboard/TaskCard.tsx:52-56 uses &lt;h4 className="font-medium">, which inherits the global `h4 { text-base sm:text-lg lg:text-xl }` (src/app/globals.css:110-112). TaskCard.tsx:31-35 draws a border per task inside a Card.
- **Fix:** (1) tasks.ts: move the whole 'chat-with-cat' object above 'set-display-name' so it leads its tier; no id or condition changes. (2) Sentence case in tasks.ts: 'Set your username' / 'Set username', 'Add your display name' / 'Add name', 'Add your bio' / 'Add bio', 'Upload a profile photo' / 'Upload photo', 'Add a Bitcoin wallet' / 'Manage wallets', and the create-tier titles likewise. (3) TaskCard.tsx:31-35 root becomes `flex items-start gap-3 py-3` (no border, `opacity-70` kept for completed) and TasksSection.tsx:254 uses `divide-y divide-subtle` in place of `space-y-3`. (4) TaskCard.tsx:53: `className={`text-sm font-medium ${isCompleted ? 'line-through text-fg-secondary' : 'text-fg-primary'}`}`.
- **Mind:** Merging the three tasks conflicts with the documented narrow condition of 'set-display-name' and its test.

### auth-firstrun#7 · medium · Orange on in-app and recovery actions, including disabled orange

**Status:** Fixed (fourth pull request).

- **Where:** /onboarding/intelligent, /dashboard/things, /auth?mode=forgot, https://orangecat.ch/auth (both, both themes)
- **What a person meets:** Orange stops meaning 'Bitcoin' or 'the one way in'. A disabled orange button reads as broken rather than 'not yet', exactly the case the fleet rule names.
- **Cause:** variant="accent" (or raw bg-accent-warm) on in-app and recovery actions: src/components/onboarding/IntelligentOnboarding.tsx:265, src/components/onboarding/OnboardingOffers.tsx:68, src/components/onboarding/OnboardingPay.tsx:48, src/app/(authenticated)/dashboard/things/page.tsx:39, src/app/auth/AuthFormBody.tsx:172 (also used in forgot mode), src/app/auth/EmailCodeSignIn.tsx:209 and :267.
- **Fix:** `variant="primary"` at IntelligentOnboarding.tsx:265 and OnboardingPay.tsx:48. OnboardingOffers.tsx:67: `variant={i === 0 ? 'primary' : 'outline'}`. things/page.tsx:37-42: `&lt;Button href={ROUTES.CREATE}>Create&lt;/Button>` (Button's link mode already runs in server pages, for example dashboard/documents/[id]/page.tsx). Auth submits follow finding 0. Gate: scripts/check-in-app-accent.mjs written as a ratchet like scripts/check-type-scale.mjs: count lines with `variant="accent"` or `bg-accent-warm … text-on-accent` under src/app/(authenticated) and src/components/onboarding, with BASELINE set to the count left after this change (may fall, never rise); add `check:in-app-accent` to package.json and to both lists in scripts/verify.mjs.

### auth-firstrun#8 · medium · Sign in versus create account: the switch is a 24px text link below the fold

**Status:** Fixed (fourth pull request).

- **Where:** /auth, /auth?mode=register, https://orangecat.ch/auth (both, both themes)
- **What a person meets:** Someone who came to create a password account scrolls past six sign-in options to find a small text link. Three targets are under 44px. Four of the six methods do not distinguish signing in from signing up at all, so the split costs attention without giving anything back.
- **Cause:** src/app/auth/AuthSocialLogin.tsx:24-30 and :92-98; src/app/auth/AuthFormBody.tsx:149, :159-165 and :201-206
- **Fix:** Fix the targets, keep the structure. AuthSocialLogin.tsx:24-30 and :92-98: `type="button"` and `className="inline-flex min-h-11 items-center px-3 font-semibold text-fg-primary"` (drop `mt-1`). AuthFormBody.tsx:149: `className="flex min-h-11 cursor-pointer select-none items-center gap-2"`; :162: `className="inline-flex min-h-11 items-center text-sm font-medium text-fg-primary"`; :201-206 link: add `inline-flex min-h-11 items-center`. If a top switch is wanted later, use SegmentedControl in button mode and, in the same change, scope the three submit lookups to the form (`page.locator('form').getByRole('button', { name: 'Sign in', exact: true })`) in scripts/check-broken-words.mjs:122, tests/e2e/helpers/login.ts:14 and scripts/auth/passkeys-e2e.mjs.
- **Mind:** The original fix breaks the check:broken-words gate and the shared e2e login helper.

### auth-firstrun#9 · medium · Social buttons lose their labels from 640px up and have no visible outline in light

**Status:** Fixed (fourth pull request).

- **Where:** /auth, /auth?mode=register, https://orangecat.ch/auth (desktop, both themes)
- **What a person meets:** On the widest screens, where there is most room, the buttons say least. In light theme they do not look like buttons at all, and a person who does not recognise the GitHub mark has nothing to read.
- **Cause:** src/app/auth/AuthSocialLogin.tsx:80 hides the provider name with `sm:hidden` although the grid stays two columns unless three or more providers are enabled (lines 63-67); line 76 uses border-subtle; line 77 hard-codes 'Sign in with'.
- **Fix:** AuthSocialLogin.tsx:76: `className="h-11 w-full"`: delete the `border-subtle hover:border-default hover:bg-surface-raised/60` override so the outline variant's border-strong applies, as on the passkey and emailed-code buttons (light #c7c7c7 = 1.57:1, dark #3d3d3d = 1.72:1). Line 80: `&lt;span className={cn('ml-2 text-sm font-medium', providers.length >= 3 && 'sm:hidden')}>{name}&lt;/span>` (import cn); keep the plain provider name, since the divider above already reads 'Or continue with'. Line 77: `aria-label={`${mode === 'login' ? 'Sign in' : 'Sign up'} with ${name}`}`.

### auth-firstrun#12 · medium · The 'What do you want to do?' door is built twice; on 'What you can do' it has no microphone and the app shell disappears

**Status:** Fixed (owner decision, 2026-11-13): visitors get the microphone too, on a per-IP budget.

- **Where:** /what-you-can-do, /dashboard/things, /dashboard (both, both themes)
- **What a person meets:** The product's one entry point behaves differently depending on the page, and here it lacks dictation. Tapping a main navigation item removes the navigation, and the logo then leads a not-yet-onboarded person into the onboarding form. The chips look misdrawn.
- **Cause:** src/components/map/TheDoor.tsx:58-70; src/components/dashboard/DashboardIntent.tsx:49-61; src/app/(public)/what-you-can-do/page.tsx:35-58 against src/app/globals.css:130-136; shell: src/config/routes.ts:187-195
- **Fix:** (1) New src/components/map/DoorExamples.tsx (no hooks), used by TheDoor and DashboardIntent: `&lt;ul aria-label="Examples" className="no-scrollbar flex gap-2 overflow-x-auto pr-8">` with `&lt;li className="shrink-0">` and `&lt;a className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full border border-default px-3 text-xs text-fg-secondary hover:border-interactive hover:text-fg-primary">` (`no-scrollbar` exists at globals.css:1350 and is used by SettingsShell.tsx:44). (2) Section pills at page.tsx:35-58: the same one-line `&lt;ul>` and `inline-flex min-h-11 items-center` on each link, `text-sm`. (3) Microphone on the public door: add a `name` prop to chatkit's DictationField, release it, then replace the input; until then line 1 of TheDoor.tsx carries `// experience-exempt: native GET form, must work without JavaScript`. (4) Shell: decide in routes.ts, for example …
- **Mind:** The original shell patch breaks the routes.ts SSOT rule ('Do not branch on pathname here'); putting DictationField in the GET form drops the documented no-JavaScript path.

### auth-firstrun#13 · medium · Password recovery is three screens in three different frames, with unlabelled inputs and 'Login' beside 'Sign in'

**Status:** Fixed (fourth pull request).

- **Where:** /auth?mode=forgot, /auth/reset-password, /auth/cant-get-email (both, both themes)
- **What a person meets:** Three steps of one stressful journey look like three products. An input's meaning disappears once something is typed into it, and the words for the same action change between screens.
- **Cause:** src/app/auth/reset-password/OtpForm.tsx:55-61 (Card, icon tile, Title Case h1), :77-98 (Input with placeholder only, no `label`), :116 and :132 ('Request New Reset Email', 'Back to Login'); src/app/auth/reset-password/page.tsx:117 and :145 ('Reset Link Invalid', 'Password Updated Successfully'); src/app/auth/reset-password/NewPasswordForm.tsx:55 ('Create New Password') and its placeholder-only inputs.
- **Fix:** OtpForm.tsx and NewPasswordForm.tsx: replace `&lt;Card className="max-w-md w-full p-8 shadow-sm">` with `&lt;div className="w-full max-w-md">`, delete the icon tile, heading `&lt;h1 className="mb-2 text-2xl font-semibold text-fg-primary">` reading 'Enter your reset code' and 'Create new password'. Inputs get labels: `&lt;Input label="Email" …>`, `&lt;Input label="6-digit code" …>`, `&lt;Input label="New password" …>`, `&lt;Input label="Confirm new password" …>`, placeholders removed; in NewPasswordForm move each eye button inside its field the way AuthFormBody.tsx:76-96 does. Buttons `className="h-12 w-full"`. Wording: 'Send a new reset email' (OtpForm.tsx:116, page.tsx:121), 'Back to sign in' (OtpForm.tsx:132, NewPasswordForm.tsx:135, page.tsx:124), 'Reset link invalid' (page.tsx:117), 'Update password', 'Password updated'; text links `inline-flex min-h-11 items-center`. Update …
- **Mind:** None, provided the e2e strings change with the copy.

### auth-firstrun#5 · low · Cat chat first-run empty state: a greeting and three registry nouns in a wrapping pill box

**Status:** Fixed (2026-11-13): @bitbaum/chatkit 0.31.3 lays the starters out in one column (bitbaum/chatkit#94).

- **Where:** /dashboard/cat, /dashboard/cat?welcome=true, /dashboard (both, both themes)
- **What a person meets:** A person with nothing is asked to choose between three internal nouns before knowing what they mean here, and nothing says what the Cat will do or that it asks before publishing. The same question gives three different sets of hints on three pages, and the wrapped pills leave an orphan.
- **Cause:** @bitbaum/chatkit styles/chat.css:1149-1153 (layout only). src/config/cat-prompts.ts:73-77 is intended.
- **Fix:** (a) In chatkit styles/chat.css: `.ck-starters-list { display: flex; flex-direction: column; gap: 0.5rem; }` and add `width: 100%;` to `.ck-starter` (one column at every width holds for any number of starters and matches EmptyState's own `flex flex-col` link list); release it and move the pin at orangecat package.json:131. No local override. (b) EmptyState.tsx, under the h2 and only when `isNewUser`: `&lt;p className="mb-0 text-center text-sm text-fg-secondary">Say it in a sentence. Your Cat drafts it and asks before anything goes live.&lt;/p>`. (c) Leave getStarterChips() alone; pass examples to the dashboard door only after the chips are rebuilt (finding 12).
- **Mind:** The original fix breaks the registry-derived starter rule and its unit test. The package CSS change reaches every product's chat, so it needs the package's own release.

### auth-firstrun#10 · low · Auth errors: browser bubbles, a banner with a pointless 'Try Again', and operator jargon

**Status:** Partly (fourth pull request): no password-length hint, per the fleet password rule in @bitbaum/accountkit.

- **Where:** /auth, /auth?mode=register (both, both themes)
- **What a person meets:** Errors appear away from the field that caused them, in browser chrome or a banner. One message blames the operator's configuration to a customer. The retry button cannot succeed on a validation error. A new person is greeted as returning.
- **Cause:** src/app/auth/useAuthSubmission.ts:54-56, :70-81 and :180-190; src/app/auth/AuthPageClient.tsx:83 and :148-157
- **Fix:** (1) useAuthSubmission.ts:54-56: 'This is taking too long. Check your connection and try again.' (2) AuthPageClient.tsx:83: `message="Signing you in…"`. (3) useAuthSubmission: `const [retryable, setRetryable] = useState(false)`; false for the three client-side throws at :70-81, true when `result.error` or a network error is caught; return it. AuthPageClient.tsx:148-157 renders the retry button only when `retryable`, labelled 'Try again'. (4) AuthFormBody.tsx, register mode: `const [confirmTouched, setConfirmTouched] = useState(false)`; on the confirm Input add `onBlur={() => setConfirmTouched(true)}`, `aria-invalid` and `aria-describedby="confirm-error"`; AFTER its `relative` wrapper (not through Input's `error` prop, which would grow the wrapper and move the centred eye button) render `{confirmTouched && formData.confirmPassword !== formData.password && &lt;p id="confirm-error" …
- **Mind:** The proposed password hint conflicts with the fleet password rule in @bitbaum/accountkit (no hint text).

### Also seen on re-check (auth-firstrun)

- HIGH. A failed sign-in lands on the password-reset code form, with no error. src/middleware.ts:53-67 redirects ANY request carrying `?error=` to /auth/reset-password. The app itself produces such URLs: auth/callback/route.ts:24, :32, :38 (failed Google/GitHub exchange) and auth/confirm/route.ts:36 (expired confirmation link). Verified on production with one GET: https://orangecat.ch/auth?error=Authentication%20failed.%20Please%20try%20again. answers 307 to /auth/reset-password?error=…; locally …
- MEDIUM. The onboarding screen has no way forward except filling both fields, and its one enabled control can leave the site. Measured (audit/auth-firstrun/verify5.cjs): on arrival 'See what Cat suggests' and 'Or just chat with your Cat instead' are both disabled (canSubmit needs name AND description, IntelligentOnboarding.tsx:53); 'Back' calls router.back() (:128-144), and in a tab that opened on '/' it navigated to about:blank. The logo leads back here every time (src/app/page.tsx:46). Also 'Or just chat…' is …
- MEDIUM. The sign-in form jumps about a second after it appears on a phone. Measured at 390x844 on /auth (verify5.cjs): cumulative layout shift 0.0935 from two shifts of the whole form block at ~0.9s and ~1.06s (0.0137 at 1440); the repo's own target is under 0.1. Cause: the column is vertically centred (AuthPageClient.tsx:101 `justify-center`), and the passkey button (mounted after hydration by design, PasskeySignInButton.tsx) and the social row (fetched, oauthProviders.ts:17-44) arrive late, so everything above …
- LOW-MEDIUM (code evidence only, not exercised). A returning person who signs in with Google, GitHub or an email link is greeted as new. auth/callback/route.ts:11 and auth/confirm/route.ts:12 default every sign-in to /dashboard/cat?welcome=true; cat/page.tsx:56 turns that parameter into `isNewUser`; EmptyState.tsx:57-59 then shows 'Tell Cat what you want to do' in place of 'Good morning, &lt;name>'. Finding 1's unification spreads this to password and code sign-ins. Fix: decide 'new' from the account, not the URL, …
- LOW-MEDIUM. 'Set up your profile' is a heading beside a chevron-only toggle, the dead-click shape scripts/check-dead-labels.mjs exists to stop, and the gate cannot see it: TasksSection.tsx:209-212 uses `&lt;CardTitle>` (an h3 at render, Card.tsx:25-27) while the gate matches only a literal `&lt;h[1-6]` within 12 lines of the button (check-dead-labels.mjs:37-39), and the button is at :229-241. Visible in before/app-dashboard-1440-dark-fold.png: the title looks like the control and only the 44px arrow at the far …
