import type { DependencyConstraint } from '@cybertecpty/nx-types';

/**
 * ADR 0004's dependency-constraint matrix — the single source of truth for which `platform:`,
 * `type:` and `domain:` tags may depend on which. Read by `@nx/enforce-module-boundaries` in the
 * root `eslint.config.mjs` for TypeScript imports, and by the .NET boundary check for the
 * `ProjectReference` edges that rule cannot see (ADR 0017).
 *
 * Keep this module free of value imports (`import type` is fine) and keep the `.mts` extension.
 * `eslint.config.mjs` imports it by relative path, where bare Node loads it with type stripping
 * only, so three things break it: a value import of a `@cybertecpty/*` alias cannot resolve
 * (those are `tsconfig` paths, not packages, and only `import type` is erased before Node
 * looks); non-erasable syntax such as an `enum` or a parameter property fails to parse; and a
 * `.ts` file here would be read as CommonJS, since this lib's `package.json` declares
 * `"type": "commonjs"`, leaving the named export invisible to an ESM importer.
 *
 * It is also exported from the `@cybertecpty/nx-utils` barrel, so the .NET check imports it by name.
 * The barrel imports it as `./nx-dep-constraints.const.mjs`, which Vitest and the transpiler Nx
 * runs executors with both resolve (ADR 0004, 2026-11-10 amendment).
 */
export const DEP_CONSTRAINTS: ReadonlyArray<DependencyConstraint> = [
  {
    // domain:shared is the cross-domain fallback: not tied to any product
    // domain and importable by every domain. It may only depend on other
    // domain:shared code — never on a product domain. Each product domain
    // adds its own `domain:<name>` rows below, with a comment saying what it owns (ADR 0004,
    // 2026-10-27 amendment).
    sourceTag: 'domain:shared',
    onlyDependOnLibsWithTags: ['domain:shared']
  },
  {
    // domain:gamers-source: the Gamer's Source product's own apps (the API host, later the Angular
    // frontend). An app is the composition root of its product, which spans several domains
    // (ADR 0004, 2026-10-27 amendment), so it may depend on a project of any domain. Rows only
    // restrict, so this row restricts nothing; it keeps the exemption visible. While the domain holds
    // only apps, a plain row is enough. If libs join it, a plain isolation row would bind the apps
    // too, so give those libs combo rows (`allSourceTags` with their `type:`) instead.
    // Narrow it when a second product arrives.
    sourceTag: 'domain:gamers-source',
    onlyDependOnLibsWithTags: ['domain:*']
  },
  {
    // domain:gaming-collection: which games a user owns, plays and wants (`libs/gaming-collection/*`).
    // Isolated: it may depend on its own domain and domain:shared, whatever the lib's `type:`. If an
    // app ever joins this domain, this row would bind it, so use combo rows then.
    sourceTag: 'domain:gaming-collection',
    onlyDependOnLibsWithTags: ['domain:gaming-collection', 'domain:shared']
  },
  {
    // Backend code. May use other backend libs and
    // environment-agnostic platform:shared libs, but never platform:frontend or
    // platform:tools — a running service must not pull in browser code or
    // workspace tooling.
    sourceTag: 'platform:backend',
    onlyDependOnLibsWithTags: ['platform:shared', 'platform:backend']
  },
  {
    // Frontend (browser) code must keep bundles small: zod's classic API
    // (`zod`, `zod/v4`) is not tree-shakeable, so browser code imports schema
    // builders from zod/mini and core errors/types from zod/v4/core. Backend
    // code has no bundle budget and is not constrained (see platform:backend).
    // See ADR 0003.
    sourceTag: 'platform:frontend',
    onlyDependOnLibsWithTags: ['platform:frontend', 'platform:shared'],
    bannedExternalImports: ['zod', 'zod/v4']
  },
  {
    // Shared code can be pulled into a browser bundle, so it carries the
    // same zod restriction as platform:frontend: shared code uses zod/mini +
    // zod/v4/core, never the classic API. zod/mini runs fine on the backend
    // too. See ADR 0003.
    sourceTag: 'platform:shared',
    onlyDependOnLibsWithTags: ['platform:shared'],
    bannedExternalImports: ['zod', 'zod/v4']
  },
  {
    // Plugins, generators, executors and their support libs. May reach into
    // platform:backend because some tooling performs backend-side operations
    // (codegen against schemas, migration helpers). The reverse is blocked:
    // platform:backend cannot import platform:tools.
    sourceTag: 'platform:tools',
    onlyDependOnLibsWithTags: ['platform:tools', 'platform:shared', 'platform:backend']
  },
  {
    // api libs contain controllers and backend request plumbing — the public
    // API surface, and own the DTOs the generated frontend contract types derive from.
    // Data access flows api -> type:services -> type:infra:
    // api never imports type:infra directly, only type:services does. (An
    // app's own composition root may also wire infra — see type:app.)
    sourceTag: 'type:api',
    onlyDependOnLibsWithTags: ['type:api', 'type:services', 'type:types', 'type:utils']
  },
  {
    // Deployable applications (Angular or .NET — platform: disambiguates). The
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
      'type:testing',
      'type:types',
      'type:ui',
      'type:utils'
    ]
  },
  {
    // Frontend data access: NgRx state, HTTP clients, facades. Talks to the
    // backend over the wire (generated type:types contracts) — never imports backend
    // libs (platform rules enforce that) or UI/feature libs.
    sourceTag: 'type:data-access',
    onlyDependOnLibsWithTags: ['type:data-access', 'type:types', 'type:testing', 'type:utils']
  },
  {
    // e2e projects drive a deployed app from the outside (HTTP / browser).
    // They may use the generated contract types and test helpers but never reach
    // into app-internal libs (feature, ui, services, infra, ...).
    sourceTag: 'type:e2e',
    onlyDependOnLibsWithTags: ['type:e2e', 'type:testing', 'type:types', 'type:utils']
  },
  {
    // Lazy-loaded, routed Angular feature areas: smart components wired to
    // type:data-access and composed from type:ui. No self-reference — each
    // feature is its own lazy boundary; shared behaviour moves down to
    // data-access / ui / utils rather than feature-to-feature imports.
    sourceTag: 'type:feature',
    onlyDependOnLibsWithTags: [
      'type:data-access',
      'type:testing',
      'type:types',
      'type:ui',
      'type:utils'
    ]
  },
  {
    // Persistence layer: drizzle schema, inferred row types, connection and
    // external-client factories. Backend-only (platform rules keep frontend out).
    // Owns the persistence shape. DTOs live in type:api, which infra cannot
    // reach, so the services layer returns domain types and type:api maps
    // them to DTOs (ADR 0004, 2026-10-28 amendment). Shared shape primitives
    // go through type:types.
    sourceTag: 'type:infra',
    onlyDependOnLibsWithTags: ['type:infra', 'type:types', 'type:utils']
  },
  {
    // services libs are the abstraction layer between type:api and type:infra.
    // They contain injectable providers with business logic and data access.
    sourceTag: 'type:services',
    onlyDependOnLibsWithTags: ['type:services', 'type:infra', 'type:types', 'type:utils']
  },
  {
    // Nx generators / executors and their support code. Runs at build/tooling
    // time only (platform:tools), so it stays off the application layers —
    // other plugin libs, types, and utils only.
    sourceTag: 'type:plugin',
    onlyDependOnLibsWithTags: ['type:plugin', 'type:types', 'type:utils']
  },
  {
    // Test helpers, mocks, fixtures, builders. May depend on any typed lib so
    // it can build doubles for it — except type:app and type:e2e, which are
    // leaf projects nothing should import (notDependOnLibsWithTags is
    // transitive). Scoped to the environment its helpers are tied to; a lib
    // whose helpers work anywhere is platform:shared (ADR 0004 2026-10-17 amendment).
    sourceTag: 'type:testing',
    onlyDependOnLibsWithTags: ['type:*'],
    notDependOnLibsWithTags: ['type:app', 'type:e2e']
  },
  {
    // Pure type-only exports: interfaces, type aliases, enums-as-const. Zero
    // runtime, zero dependencies — may import nothing but other type:types
    // libs. This is the leaf the whole graph can safely depend on. `@angular/common/http` is
    // banned (see type:ui): type:ui may depend on this layer, and the rule only checks a lib's
    // own imports, not those of the libs it reaches.
    sourceTag: 'type:types',
    onlyDependOnLibsWithTags: ['type:types'],
    bannedExternalImports: ['@angular/common/http']
  },
  {
    // Presentational Angular components: inputs/outputs only, no injected
    // data services. Types its inputs against type:types, which includes the generated
    // contract types: they are erased at compile time. `@angular/common/http` is banned
    // outright (`HttpClient`, `provideHttpClient`, interceptors, `httpResource`): the ban matches
    // a module, not an imported name, and transport belongs in type:data-access.
    sourceTag: 'type:ui',
    onlyDependOnLibsWithTags: ['type:testing', 'type:types', 'type:ui', 'type:utils'],
    bannedExternalImports: ['@angular/common/http']
  },
  {
    // Stateless, isomorphic helper functions. Depends on type:types and other
    // util libs only. `@angular/common/http` is banned
    // (see type:ui): type:ui may depend on this layer, and the rule only checks a lib's own
    // imports, not those of the libs it reaches.
    sourceTag: 'type:utils',
    onlyDependOnLibsWithTags: ['type:types', 'type:utils'],
    bannedExternalImports: ['@angular/common/http']
  }
];
