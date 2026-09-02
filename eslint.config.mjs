import nx from '@nx/eslint-plugin';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

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
      '**/.remember'
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
          depConstraints: [
            {
              // domain:shared is the cross-domain fallback: not tied to any product
              // domain and importable by every domain. It may only depend on other
              // domain:shared code — never on a product domain. Each product domain
              // adds its own `domain:<name>` row via that domain's ADR (ADR 0004).
              sourceTag: 'domain:shared',
              onlyDependOnLibsWithTags: ['domain:shared']
            },
            {
              // Backend (Node / NestJS) code. May use other backend libs and
              // environment-agnostic scope:shared libs, but never scope:frontend or
              // scope:tools — a running service must not pull in browser code or
              // workspace tooling.
              sourceTag: 'scope:backend',
              onlyDependOnLibsWithTags: ['scope:shared', 'scope:backend']
            },
            {
              // Frontend (browser) code must keep bundles small: zod's classic API
              // (`zod`, `zod/v4`) is not tree-shakeable, so browser code imports schema
              // builders from zod/mini and core errors/types from zod/v4/core. Backend
              // code has no bundle budget and is not constrained (see scope:backend).
              // See ADR 0003.
              sourceTag: 'scope:frontend',
              onlyDependOnLibsWithTags: ['scope:frontend', 'scope:shared'],
              bannedExternalImports: ['zod', 'zod/v4']
            },
            {
              // Shared code can be pulled into a browser bundle, so it carries the
              // same zod restriction as scope:frontend: type:models wire contracts
              // (and any other shared code) use zod/mini + zod/v4/core, never the
              // classic API. zod/mini runs fine on the backend too. See ADR 0003.
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared'],
              bannedExternalImports: ['zod', 'zod/v4']
            },
            {
              // Plugins, generators, executors and their support libs. May reach into
              // scope:backend because some tooling performs backend-side operations
              // (codegen against schemas, migration helpers). The reverse is blocked:
              // scope:backend cannot import scope:tools.
              sourceTag: 'scope:tools',
              onlyDependOnLibsWithTags: ['scope:tools', 'scope:shared', 'scope:backend']
            },
            {
              // api libs contain controllers and backend request plumbing — the public
              // API surface. Wire contracts (zod schemas + inferred types) live in shared
              // type:models libs. Data access flows api -> type:services -> type:infra:
              // api never imports type:infra directly, only type:services does. (An
              // app's own composition root may also wire infra — see type:app.)
              sourceTag: 'type:api',
              onlyDependOnLibsWithTags: [
                'type:api',
                'type:services',
                'type:models',
                'type:types',
                'type:utils'
              ]
            },
            {
              // Deployable applications (Angular or Nest — scope: disambiguates). The
              // composition root: it may wire any layer, including type:infra directly
              // (the one exception to the api -> services -> infra flow). Nothing
              // depends on a type:app project in turn.
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: [
                'type:api',
                'type:core',
                'type:data-access',
                'type:feature',
                'type:infra',
                'type:models',
                'type:services',
                'type:testing',
                'type:types',
                'type:ui',
                'type:utils'
              ]
            },
            {
              // Eagerly-loaded Angular libs: root providers, app config, guards,
              // interceptors — what the app must have at bootstrap. Cannot depend on
              // type:feature: an eager lib statically importing a lazy one defeats the
              // split. One type:core lib per app, so no self-reference.
              sourceTag: 'type:core',
              onlyDependOnLibsWithTags: [
                'type:data-access',
                'type:models',
                'type:testing',
                'type:types',
                'type:ui',
                'type:utils'
              ]
            },
            {
              // Frontend data access: NgRx state, HTTP clients, facades. Talks to the
              // backend over the wire (type:models contracts) — never imports backend
              // libs (scope rules enforce that) or UI/feature libs.
              sourceTag: 'type:data-access',
              onlyDependOnLibsWithTags: [
                'type:data-access',
                'type:models',
                'type:types',
                'type:testing',
                'type:utils'
              ]
            },
            {
              // e2e projects drive a deployed app from the outside (HTTP / browser).
              // They may use shared wire contracts and test helpers but never reach
              // into app-internal libs (feature, ui, services, infra, ...).
              sourceTag: 'type:e2e',
              onlyDependOnLibsWithTags: [
                'type:e2e',
                'type:models',
                'type:testing',
                'type:types',
                'type:utils'
              ]
            },
            {
              // Lazy-loaded, routed Angular feature areas: smart components wired to
              // type:data-access and composed from type:ui. No self-reference — each
              // feature is its own lazy boundary; shared behaviour moves down to
              // data-access / ui / utils rather than feature-to-feature imports.
              sourceTag: 'type:feature',
              onlyDependOnLibsWithTags: [
                'type:data-access',
                'type:models',
                'type:testing',
                'type:types',
                'type:ui',
                'type:utils'
              ]
            },
            {
              // Persistence layer: drizzle schema, inferred row types, connection and
              // external-client factories. Backend-only (scope rules keep frontend out).
              // Owns the persistence shape; it does NOT import type:models — the wire
              // contract is a separate representation, and mapping row <-> DTO is
              // type:services' job. Shared shape primitives go through type:types.
              sourceTag: 'type:infra',
              onlyDependOnLibsWithTags: ['type:infra', 'type:types', 'type:utils']
            },
            {
              // services libs are the abstraction layer between type:api and type:infra.
              // They contain injectable providers with business logic and data access.
              sourceTag: 'type:services',
              onlyDependOnLibsWithTags: [
                'type:services',
                'type:infra',
                'type:models',
                'type:types',
                'type:utils'
              ]
            },
            {
              // Wire contracts: zod schemas + inferred types, the shared FE/BE source
              // of truth for request/response shapes. Kept lean — types, utils, and
              // other model libs only. (scope:shared, so the zod/mini ban applies.)
              sourceTag: 'type:models',
              onlyDependOnLibsWithTags: ['type:models', 'type:types', 'type:utils']
            },
            {
              // Nx generators / executors and their support code. Runs at build/tooling
              // time only (scope:tools), so it stays off the application layers —
              // other plugin libs, types, and utils only.
              sourceTag: 'type:plugin',
              onlyDependOnLibsWithTags: ['type:plugin', 'type:types', 'type:utils']
            },
            {
              // Test helpers, mocks, fixtures, builders. May depend on any typed lib so
              // it can build doubles for it — except type:app and type:e2e, which are
              // leaf projects nothing should import (notDependOnLibsWithTags is
              // transitive). Scoped frontend or backend, never shared, so a mock does
              // not leak across environments.
              sourceTag: 'type:testing',
              onlyDependOnLibsWithTags: ['type:*'],
              notDependOnLibsWithTags: ['type:app', 'type:e2e']
            },
            {
              // Pure type-only exports: interfaces, type aliases, enums-as-const. Zero
              // runtime, zero dependencies — may import nothing but other type:types
              // libs. This is the leaf the whole graph can safely depend on.
              sourceTag: 'type:types',
              onlyDependOnLibsWithTags: ['type:types']
            },
            {
              // Presentational Angular components: inputs/outputs only, no injected
              // data services. Types its inputs against type:types, not type:models —
              // the view layer stays decoupled from the wire shape.
              sourceTag: 'type:ui',
              onlyDependOnLibsWithTags: ['type:testing', 'type:types', 'type:ui', 'type:utils']
            },
            {
              // Stateless, isomorphic helper functions. Depends on type:types and other
              // util libs only — never type:models (that would couple generic helpers
              // to domain shapes and risks a models <-> utils cycle).
              sourceTag: 'type:utils',
              onlyDependOnLibsWithTags: ['type:types', 'type:utils']
            }
          ]
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
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs'
    ],
    // Override or add rules here
    rules: {}
  },
  // Keep last: turns off ESLint stylistic rules that would conflict with Prettier.
  // Formatting is owned by `nx format` / the Prettier extension, not ESLint.
  eslintConfigPrettier
];
