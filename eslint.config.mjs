import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';
import unusedImports from 'eslint-plugin-unused-imports';
import * as espree from 'espree';

// ESLint 9 flat config. eslint-config-next 16 requires ESLint >=9 and `next lint`
// was removed in Next 16, so this replaces .eslintrc.json + .eslintignore. The
// rule set is carried over verbatim; eslint-config-next 16's native flat configs
// are composed directly (FlatCompat crashes on the react plugin's circular object).

// Shared no-restricted-syntax selectors. Flat config REPLACES (not merges) a
// rule's options when a later block redefines it, so any scoped block that adds
// a selector must spread these to keep the base set active there.
const restrictedSyntaxSelectors = [
  {
    selector: 'Identifier[name=/[Cc]ampaign/]',
    message:
      "CLAUDE.md bans 'Campaign' terminology — use 'Project' instead. The canonical entity name is in ENTITY_REGISTRY.project.",
  },
  {
    selector: 'Identifier[name=/[Cc]rowdfund/]',
    message: "CLAUDE.md bans 'crowdfund' terminology — use 'fund' / 'funding' / 'project' instead.",
  },
  {
    selector:
      'Literal[value=/dark:(?:bg|text|border|ring|from|to|via|fill|stroke)-(?:gray|slate|zinc|neutral|stone)-\\d+/]',
    message:
      'Raw Tailwind gray in dark: variant — use a semantic token (bg-muted, bg-border, border, text-foreground, text-muted-foreground, etc.). See globals.css :root for available tokens. Add eslint-disable-next-line with a reason comment if this is an intentional design exception.',
  },
  {
    // Close the "[object Object]" class (2026-09-05). apiError() answers
    // `{ success: false, error: { code, message } }` — `error` is an OBJECT, and
    // a non-empty object is truthy, so `X.error || 'fallback'` never reaches the
    // fallback and hands an object to new Error()/toast.error()/setState():
    //   new Error({code,message}) -> message is the string "[object Object]"
    //   setError({code,message})  -> React throws on rendering a non-child
    // 100 call sites did this. A user hit it trying to follow someone: the
    // server sent "Already following this user" and the toast read
    // "[object Object]". apiErrorMessage() reads the standard envelope, a bare
    // { message }, and a plain string, so it is correct at every call site.
    // Scoped to a STRING fallback on purpose. `if (result.error || !result.data)`
    // is a truthiness guard and completely correct; an earlier, broader version
    // of this selector flagged those too, and a gate that fires on correct code
    // gets disabled rather than obeyed. Only `X.error || <string>` is the bug:
    // it defaults an object to a message.
    selector:
      "LogicalExpression[operator='||'][right.value=/./] > MemberExpression.left[property.name='error']",
    message:
      "`X.error || 'fallback'` — the standard API envelope makes `error` an OBJECT, so this yields \"[object Object]\" and the fallback never fires. Use apiErrorMessage(X, 'fallback') from '@/lib/api/errorMessage'.",
  },
  {
    selector:
      "LogicalExpression[operator='||'][right.type='TemplateLiteral'] > MemberExpression.left[property.name='error']",
    message:
      "`X.error || `fallback`` — the standard API envelope makes `error` an OBJECT, so this yields \"[object Object]\" and the fallback never fires. Use apiErrorMessage(X, `fallback`) from '@/lib/api/errorMessage'.",
  },
  {
    selector: 'Literal[value=/dark:(?:bg|text|border|ring)-\\[#[0-9a-fA-F]+\\]/]',
    message:
      'Arbitrary hex color in dark: variant — define a CSS custom property in globals.css and use a semantic Tailwind class instead.',
  },
  {
    selector: 'Literal[value=/\\btext-\\[10px\\]/]',
    message:
      "Arbitrary text-[10px] — use the text-2xs token (10px, defined in tailwind.config.ts). It exists for exactly this; don't bypass it.",
  },
  {
    // Close the keystroke-hijack class (2026-07 dogfood): a global keyboard
    // shortcut's "is the user typing?" guard must inspect the COMPOSED path
    // leaf, not e.target. When a keystroke crosses a shadow-DOM boundary
    // (e.g. the embedded Loki feedback widget), e.target is retargeted
    // to the shadow host, so the guard misreads a text field as "not typing"
    // and the shortcut fires and eats the keystroke. Pass e.composedPath()[0].
    selector:
      "CallExpression[callee.name='isTypingTarget'] > MemberExpression.arguments[property.name='target']",
    message:
      'Pass the composed-path leaf to isTypingTarget (e.composedPath()[0] ?? e.target), not a bare e.target — a bare .target is shadow-DOM-blind and reintroduces the keystroke-hijack bug.',
  },
  {
    // Close the stored-XSS class (2026-08-24): z.string().url() delegates to
    // new URL(), which accepts `javascript:` and `data:`. A value that passes
    // it and is later rendered into an href is stored XSS — and rel/target do
    // nothing against it. Found live on the public wishlist page, where
    // external_url went straight into an anchor labelled "View item →".
    // Matches `.url()` anywhere on a z.string() chain, so z.string().max(n).url()
    // is caught too. Known blind spot: assigning the chain to a variable first
    // (`const s = z.string(); s.url()`) is invisible to an AST selector — that is
    // exactly the escape hatch webUrl() itself uses, and the reason webUrl() has
    // unit tests asserting the schemes it must refuse.
    selector:
      "CallExpression[callee.property.name='url'] > MemberExpression CallExpression[callee.object.name='z'][callee.property.name='string']",
    message:
      "z.string().url() accepts javascript: and data: URLs — use webUrl() from '@/lib/validation/base', which restricts to http(s). Any user-supplied URL may end up in an href.",
  },
];

const eslintConfig = [
  {
    // Translated from the former .eslintignore (flat config ignores it).
    ignores: [
      // Vendored: byte-for-byte mirror of loki/src/lib/agent/core.
      // `eslint --fix` here would rewrite quotes and break the SHA-256 drift
      // gate that keeps the two copies from silently disagreeing about what
      // "grounded" means. Edit the canonical copy in Loki and re-run
      // its `npm run sync:agent-core`. See src/services/agent-core/README.md.
      'src/services/agent-core/**',
      '.next/**',
      'out/**',
      'dist/**',
      'build/**',
      'node_modules/**',
      'coverage/**',
      '.cache/**',
      '.turbo/**',
      'scripts/**/*.js',
      'scripts/**/*.ts',
      'src/scripts/**/*.js',
      'src/scripts/**/*.ts',
      'next.config.js',
      '*.config.js',
      '*.config.ts',
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    // unused-imports lives in its own object so its plugin is registered without
    // scoping the react/@next/@typescript-eslint rule references below (which
    // resolve against the plugins the next flat configs register globally).
    plugins: { 'unused-imports': unusedImports },
    rules: {
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Scoped to the same code files eslint-config-next registers react/@next/@typescript-eslint/import
    // for, so those rule references resolve to a registered plugin.
    files: ['**/*.{js,jsx,mjs,ts,tsx,mts,cts}'],
    settings: { react: { version: '19.2.8' } }, // 'detect' hits ESLint 10's removed context.getFilename() inside eslint-plugin-react
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      // Code quality rules
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      // React rules
      'react/no-unescaped-entities': 'off',
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/display-name': 'off',
      'react/jsx-key': 'error',
      'react/jsx-no-target-blank': 'error',
      'react/jsx-no-duplicate-props': 'error',
      'react/no-danger-with-children': 'error',
      'react/no-deprecated': 'error',
      'react/no-direct-mutation-state': 'error',
      'react/no-is-mounted': 'error',
      'react/no-render-return-value': 'error',
      'react/no-string-refs': 'error',
      'react/no-unknown-property': 'error',
      'react/require-render-return': 'error',
      // Next.js rules
      '@next/next/no-html-link-for-pages': 'off',
      // Import rules
      'import/no-unresolved': 'off',
      'import/no-duplicates': 'off',
      // General code quality
      eqeqeq: ['error', 'always'],
      curly: 'warn',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-restricted-syntax': ['error', ...restrictedSyntaxSelectors],
      // Lock @deprecated count at 0.
      'no-warning-comments': ['error', { terms: ['@deprecated'], location: 'anywhere' }],
      // eslint-plugin-react-hooks v6 (bundled with Next 16's eslint-config-next) adds
      // React-Compiler-era rules absent from the Next 15 config; adopting them across
      // this codebase is a dedicated refactor, out of scope for the framework upgrade.
      // Deferred — rules-of-hooks and exhaustive-deps (below) stay enabled.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/error-boundaries': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/purity': 'off',
    },
  },
  {
    // SSOT gate (never-twice): internal '/api/…' paths must come from
    // API_ROUTES (src/config/api-routes.ts) or PUBLIC_API_BASE
    // (src/config/public-api.ts) — never hardcoded strings. Exempt: the SSOT
    // configs themselves, the route handlers under src/app/api/ (they ARE the
    // paths), middleware/robots (path-matching infrastructure), and tests.
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      'src/config/**',
      'src/app/api/**',
      'src/middleware.ts',
      'src/app/robots.ts',
      '**/__tests__/**',
      '**/*.test.*',
      '**/*.spec.*',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...restrictedSyntaxSelectors,
        {
          selector: 'Literal[value=/^\\u002Fapi\\u002F/]',
          message:
            "Hardcoded '/api/…' path — import API_ROUTES from '@/config/api-routes' (or PUBLIC_API_BASE from '@/config/public-api' for versioned v1 URLs) and reference the endpoint there. Add the entry if it's missing.",
        },
      ],
    },
  },
  {
    // Envelope gate (never-twice): API routes speak the standard envelope via
    // apiSuccess/apiError & friends (src/lib/api/standardResponse.ts) — raw
    // NextResponse.json drifts payload shapes and skips error logging. The only
    // wire-format exceptions are LNURL (protocol-fixed JSON) and the OpenAPI
    // spec document, carved out below.
    files: ['src/app/api/**/*.{ts,tsx}'],
    ignores: ['src/app/api/lnurlp/**', 'src/app/api/v1/openapi.json/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...restrictedSyntaxSelectors,
        {
          selector:
            "CallExpression[callee.object.name='NextResponse'][callee.property.name='json']",
          message:
            "Raw NextResponse.json in an API route — use apiSuccess/apiError (and friends) from '@/lib/api/standardResponse' so every endpoint speaks the standard envelope. Only lnurlp/** and v1/openapi.json/** (fixed wire formats) are exempt.",
        },
      ],
    },
  },
  {
    // Prevent direct formatSats usage in components - must use useDisplayCurrency hook.
    files: ['src/components/**/*.{ts,tsx}', 'src/app/**/*.{ts,tsx}'],
    ignores: ['**/hooks/**', '**/*.test.*', '**/*.spec.*'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/services/currency',
              importNames: ['formatSats'],
              message:
                "Use useDisplayCurrency().formatAmount() for user-facing amounts. formatSats ignores user's currency preference.",
            },
            {
              name: '@/utils/currency',
              importNames: ['formatSats'],
              message:
                "Use useDisplayCurrency().formatAmount() for user-facing amounts. formatSats ignores user's currency preference.",
            },
            {
              name: '@/services/mempool',
              importNames: ['formatSats'],
              message:
                "Use useDisplayCurrency().formatAmount() for user-facing amounts. formatSats ignores user's currency preference.",
            },
            {
              name: '@/services/projects/support/helpers',
              importNames: ['formatSats'],
              message:
                "Use useDisplayCurrency().formatAmount() for user-facing amounts. formatSats ignores user's currency preference.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': 'allow-with-description',
          'ts-nocheck': true,
          'ts-check': false,
        },
      ],
    },
  },

  {
    // ESLint 10 dropped the implicit scopeManager.addGlobals that Next's
    // bundled babel-eslint-parser (the default for plain .js/.mjs under
    // eslint-config-next) relied on. None of these files need Babel/JSX-only
    // syntax, so use the plain espree parser instead.
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: { parser: espree },
  },
];

export default eslintConfig;
