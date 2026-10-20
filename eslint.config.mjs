import eslintComments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import ngrx from '@ngrx/eslint-plugin';
import nx from '@nx/eslint-plugin';
import vitest from '@vitest/eslint-plugin';
import eslintConfigPrettier from 'eslint-config-prettier';
import astro from 'eslint-plugin-astro';
import jest from 'eslint-plugin-jest';
import perfectionist from 'eslint-plugin-perfectionist';
import playwright from 'eslint-plugin-playwright';
import unicorn from 'eslint-plugin-unicorn';
import tseslint from 'typescript-eslint';
import { DEP_CONSTRAINTS } from './tools/nx/utils/src/lib/nx-dep-constraints.const.mts';

// Projects that test with Vitest instead of Jest: Astro content sites only (ADR 0007,
// 2026-09-23 amendment). Flat config globs can't read project tags, so they are listed
// by path.
const vitestSpecFiles = ['apps/cybertec-io/**/*.{spec,test}.ts'];

// type:e2e projects (ADR 0010): Playwright, not Jest or Vitest — same "list by path"
// reason as vitestSpecFiles above. e2e projects are nested at `apps/<app>/e2e` (ADR 0010,
// 2026-10-09 amendment), so this overlaps vitestSpecFiles; both test-runner blocks
// below ignore these files.
const playwrightSpecFiles = ['apps/*/e2e/**/*.spec.ts'];

// The shared Playwright lib's gate code (`defineLighthouseTests`, `defineAxeTests`) calls
// Playwright's `test()` / `expect`, so it gets the Playwright rules too. Matched by folder,
// not suffix. The lib's own unit specs run under Jest, so they are left out here and keep
// the Jest block.
const playwrightLibFiles = ['libs/shared/playwright/**/*.ts'];
const playwrightLibIgnores = ['libs/shared/playwright/**/*.spec.ts'];

// The two globs above are workspace-root-relative, but flat config resolves `files` /
// `ignores` against the directory of the config file ESLint loaded — and per-project lint
// loads `apps/<app>/eslint.config.mjs`, which spreads this file. Every block that uses
// them sets `basePath` to pin matching to the workspace root (ESLint >= 9.30).
const workspaceRoot = import.meta.dirname;

const lodashMessage =
  'Import from lodash-es instead so bundle builds can tree-shake lodash utilities.';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/out-tsc',
      '**/coverage',
      '**/.nx',
      '**/node_modules',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
      '**/test-results',
      '**/playwright-report',
      '**/__screenshots__',
      '**/.angular',
      '**/.astro',
      '**/.remember',
      // Jest config files (root + per-project) are tooling, not lint targets; the
      // root `jest.config.ts` is also outside every tsconfig, which trips the
      // typed-linting project service.
      '**/jest.config.*',
      '**/jest.preset.js'
    ]
  },
  {
    files: ['**/*.{ts,tsx,cts,mts,js,jsx,cjs,mjs}'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [...DEP_CONSTRAINTS]
        }
      ]
    }
  },
  // Typed linting (type-aware rules) — TS source only. `recommendedTypeChecked` pulls in
  // the rules that need the type-checker: no-floating-promises, no-misused-promises,
  // await-thenable, no-unnecessary-condition, restrict-template-expressions, and so on —
  // the highest-value part of the ruleset for an async-heavy Angular + NestJS codebase.
  // `strictTypeChecked` is deliberately not used: its no-unsafe-* family fires at every
  // untyped boundary and most of it ends up disabled. Promote individual strict rules
  // in the override block below if wanted.
  //
  // Enabled once here for every project. `@nx/js:library`'s per-project
  // `enableTypedLinting` is left off (nx.json generator default) so the parser wiring
  // lives in exactly one place rather than being copied into each lib's config.
  ...tseslint.configs.recommendedTypeChecked.map(config => ({
    ...config,
    files: ['**/*.{ts,tsx,cts,mts}']
  })),
  {
    // Parser project wiring — after the spread so `recommendedTypeChecked`'s base entry
    // cannot clobber it. `projectService: true` resolves each file to its nearest
    // tsconfig; `tsconfigRootDir` anchors that lookup at the workspace root. A stray
    // .ts/.mts/.cts file that no project's tsconfig includes will error here — add it to
    // a tsconfig, or list a glob under `projectService.allowDefaultProject`.
    files: ['**/*.{ts,tsx,cts,mts}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  {
    // `@typescript-eslint/no-deprecated` ships in `strict-type-checked`, not
    // `recommendedTypeChecked`, so it is opted into here on its own. It flags use of
    // any symbol annotated `@deprecated` — cheap now that the type-checker is wired,
    // and the highest-value strict rule against Angular / NestJS deprecation churn
    // across minor versions. Turned back off for JS by `disableTypeChecked` below.
    files: ['**/*.{ts,tsx,cts,mts}'],
    rules: {
      '@typescript-eslint/no-deprecated': 'error'
    }
  },
  {
    // Type-aware rules cannot run on files outside a TS program — JS/CJS/MJS config
    // files (this file, jest configs, generator scripts). Turn them back off there so a
    // plain .js file does not fail with a "parserServices" error.
    files: ['**/*.{js,cjs,mjs,jsx}'],
    ...tseslint.configs.disableTypeChecked
  },
  {
    // Type-aware rule overrides for test files: spec code leans on `any` from mocks and
    // fixtures, so the no-unsafe-* family and unbound-method are noise here.
    // no-floating-promises stays on — an un-awaited promise in a test is a real bug
    // (the assertion never runs and the test passes green).
    files: ['**/*.{spec,test}.{ts,tsx,cts,mts}'],
    rules: {
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/unbound-method': 'off'
    }
  },
  {
    // Bundle hygiene (all code, all extensions): lodash's CommonJS entry points
    // defeat tree-shaking, so every runtime import must go through lodash-es. The
    // TS-aware rule lets `import type` through since it is erased at build time.
    files: ['**/*.{ts,tsx,cts,mts,js,jsx,cjs,mjs}'],
    rules: {
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'lodash', message: lodashMessage, allowTypeImports: true }],
          patterns: [{ group: ['lodash/*'], message: lodashMessage, allowTypeImports: true }]
        }
      ]
    }
  },
  {
    // eslint-plugin-unicorn: a curated list of bug-catching rules, never its opinionated
    // `recommended` preset. Held at ^65 until the ESLint 10 migration. See ADR 0008,
    // 2026-10-16 amendment.
    files: ['**/*.{ts,tsx,cts,mts,js,jsx,cjs,mjs}'],
    plugins: { unicorn },
    rules: {
      'unicorn/prefer-node-protocol': 'error',
      'unicorn/error-message': 'error',
      'unicorn/throw-new-error': 'error',
      'unicorn/new-for-builtins': 'error',
      'unicorn/no-instanceof-builtins': 'error',
      'unicorn/no-thenable': 'error',
      'unicorn/no-await-in-promise-methods': 'error',
      'unicorn/no-single-promise-in-promise-methods': 'error',
      'unicorn/no-array-fill-with-reference-type': 'error',
      'unicorn/no-unused-array-method-return': 'error',
      'unicorn/no-negation-in-equality-check': 'error',
      'unicorn/no-accessor-recursion': 'error',
      'unicorn/no-new-buffer': 'error',
      'unicorn/no-invalid-remove-event-listener': 'error',
      'unicorn/prefer-structured-clone': 'error'
    }
  },
  {
    // Declaration order (conventions §8): type declarations before runtime ones, exported
    // functions before private helpers, alphabetized within each group. Only `sort-modules`,
    // never the plugin's presets, and none of its import/export rules: import order belongs
    // to prettier-plugin-organize-imports. The rule leaves `const` / `let`, expression
    // statements and control flow where they are and sorts only the runs between them; class
    // and enum dependencies are tracked. See ADR 0008, 2026-10-20 amendment.
    files: ['**/*.{ts,tsx,cts,mts}'],
    plugins: { perfectionist },
    rules: {
      'perfectionist/sort-modules': [
        'error',
        { groups: [['interface', 'type', 'enum'], 'class', 'export-function', 'function'] }
      ]
    }
  },
  // NgRx SignalStore lint rules. Spread the plugin's flat config (the `ngrx/base`
  // plugin registration + the signals rule set) and narrow each entry to app/lib
  // TS source. NgRx is Angular-only, but the workspace has no frontend path
  // convention (ADR 0003 makes browser-reachability a `scope:` tag, which flat
  // config's path globs can't read), so `{apps,libs}` is a coarse proxy that at
  // least keeps the rules off `tools/**` and root scripts. The rules are inert on
  // non-NgRx files. Revisit (per-project spread) when the Angular ADR lands.
  ...ngrx.configs.signals.map(config => ({ ...config, files: ['{apps,libs}/**/*.ts'] })),
  {
    // Jest lint rules for spec files and test artifacts (doubles and fixtures —
    // `<name>.<kind>.ts`, ADR 0008 2026-10-17 amendment). `flat/recommended` brings the
    // plugin, the jest globals, and the recommended rule set (no-focused-tests,
    // no-disabled-tests, valid-expect, ...); the overrides below relax
    // TS rules that are noise in test code.
    basePath: workspaceRoot,
    files: ['**/*.{spec,test}.ts', '**/*.{mock,mocks,stub,stubs,fake,fakes,fixture,fixtures}.ts'],
    ignores: [...vitestSpecFiles, ...playwrightSpecFiles],
    ...jest.configs['flat/recommended'],
    rules: {
      ...jest.configs['flat/recommended'].rules,
      '@nx/enforce-module-boundaries': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off'
    }
  },
  {
    // Vitest lint rules for the Vitest projects' spec files (see `vitestSpecFiles`), in
    // place of the Jest block above. Same TS relaxations as the Jest block.
    basePath: workspaceRoot,
    files: vitestSpecFiles,
    ignores: playwrightSpecFiles,
    ...vitest.configs.recommended,
    rules: {
      ...vitest.configs.recommended.rules,
      '@nx/enforce-module-boundaries': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off'
    }
  },
  {
    // Playwright lint rules for e2e spec files (see `playwrightSpecFiles`), in place of
    // the Jest block above — no TS relaxation block needed, e2e specs don't lean on
    // mock `any`s the way unit specs do.
    basePath: workspaceRoot,
    files: playwrightSpecFiles,
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      '@nx/enforce-module-boundaries': 'off'
    }
  },
  {
    // The same Playwright rules for the shared lib's gate code (see `playwrightLibFiles`).
    // Unlike the specs above, it is production code of a lib, so module boundaries stay on.
    basePath: workspaceRoot,
    files: playwrightLibFiles,
    ignores: playwrightLibIgnores,
    ...playwright.configs['flat/recommended']
  },
  // Astro components (ADR 0012). `flat/recommended` parses `.astro` files and lints their
  // frontmatter and `<script>` blocks as virtual `*.astro/*.{js,ts}` files. Its
  // rules-only entry has no `files`, so it is scoped to `.astro` here to keep it off
  // everything else.
  ...astro.configs['flat/recommended'].map(config =>
    config.files || config.plugins ? config : { ...config, files: ['**/*.astro'] }
  ),
  {
    // Those virtual script files aren't in any tsconfig, so type-aware rules can't run
    // on them (the same reason JS files are excluded above).
    files: ['**/*.astro', '**/*.astro/*.{js,ts}'],
    ...tseslint.configs.disableTypeChecked
  },
  {
    // A stale `eslint-disable` should not rot silently as the ruleset tightens.
    // Replaces the now-deprecated eslint-comments/no-unused-disable rule with the
    // ESLint built-in (v9+).
    linterOptions: {
      reportUnusedDisableDirectives: 'error'
    }
  },
  {
    // ESLint directive-comment hygiene. `recommended` requires a matching
    // `eslint-enable` for block disables and forbids unlimited / duplicate / unused
    // directives; `require-description` (not in `recommended`) additionally forces
    // every disable to carry a reason. Keeps `eslint-disable` auditable given the
    // deliberately strict ruleset (bundle bans, boundary matrix, typed rules).
    files: ['**/*.{ts,tsx,cts,mts,js,jsx,cjs,mjs}'],
    ...eslintComments.recommended,
    rules: {
      ...eslintComments.recommended.rules,
      '@eslint-community/eslint-comments/require-description': 'error'
    }
  },
  {
    files: ['**/*.json'],
    // Override or add rules here
    rules: {},
    languageOptions: {
      parser: await import('jsonc-eslint-parser')
    }
  },
  // Keep last: turns off ESLint stylistic rules that would conflict with Prettier.
  // Formatting is owned by `nx format` / the Prettier extension, not ESLint.
  eslintConfigPrettier
];
