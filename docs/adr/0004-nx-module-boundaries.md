# 4. Nx module boundaries — project tags and dependency constraints

- Status: accepted
- Date: 2026-09-02
- Deciders: djmcgrath
- Implemented by: `@nx/enforce-module-boundaries` `depConstraints` in `eslint.config.mjs`; this ADR

## Context and problem statement

Nothing in an Nx workspace stops any project from importing any other project. Left
unchecked, the dependency graph collapses over time: frontend libs import backend libs,
feature libs bypass the service layer to reach infrastructure directly, product areas
grow tangled cross-references, and a browser-only dependency ends up in a Node service (or
the reverse). By the time this shows up in a review it is load-bearing.

Nx ships `@nx/enforce-module-boundaries`, an ESLint rule that reads free-form **tags** off
each project and enforces declared `depConstraints` at lint time. This workspace is a
single multi-domain monorepo — all product code lives here, targeting Angular on the
frontend and NestJS on the backend (ADR 0005) — so the boundary model has to cover runtime
environment, architectural layer, and product domain at once.

ADR 0003 already put the first `depConstraints` entries in place (the `platform:frontend` /
`platform:shared` external-import bans for zod). This ADR defines the full tag vocabulary and
the complete constraint matrix those entries live in.

## Decision drivers

- Architectural violations should fail `nx lint`, not wait for a reviewer to notice an
  import.
- A project's tags should tell you where it sits without reading its code.
- One place to change a rule, applied across the whole workspace.
- Product domains isolated by default — sharing between them is a deliberate, reviewable
  act.
- The same tag axis (`platform:`) that answers "is this browser-reachable?" for ADR 0003
  should answer "can this import that?" here — no parallel mechanism.

## Considered options

1. **`@nx/enforce-module-boundaries` with a three-axis tag system.**
2. **No enforcement** — document the intended layering, rely on code review.
3. **`no-restricted-imports` path patterns** — ban imports by file path rather than by
   project graph.
4. **Split boundaries into separate repos / published packages** — physical separation
   instead of a lint rule.

## Decision outcome

Chosen option: **1 — `@nx/enforce-module-boundaries` with a three-axis tag system.**

- Option 2 is the status quo we are trying to avoid; the drift is invisible until someone
  maps the graph.
- Option 3 has no graph awareness — it cannot express "api may not reach infra" without
  hard-coding directory layout into regexes, and it breaks the moment a project moves.
- Option 4 is a heavy structural commitment (versioning, release choreography, cross-repo
  refactors) for a single-owner workspace that benefits from atomic changes across the
  graph.

### The three axes

Every project carries **exactly one tag on each of three axes**. All three are mandatory
(see "no catch-all" below).

**`platform:<env>`** — runtime environment.

| value               | meaning                                                                                |
| ------------------- | -------------------------------------------------------------------------------------- |
| `platform:frontend` | browser only (Angular)                                                                 |
| `platform:backend`  | Node only (NestJS)                                                                     |
| `platform:shared`   | environment-agnostic; importable by both, so it must stay browser-safe                 |
| `platform:tools`    | workspace tooling (generators, executors, scripts); not importable by application code |

**`type:<role>`** — architectural role.

| value              | meaning                                                                        |
| ------------------ | ------------------------------------------------------------------------------ |
| `type:app`         | deployable application (Angular or Nest; `platform:` disambiguates)            |
| `type:e2e`         | end-to-end test project for one app                                            |
| `type:core`        | eagerly-loaded Angular libs: app-level providers, config, guards, interceptors |
| `type:feature`     | lazy-loaded, routed Angular feature libs                                       |
| `type:ui`          | presentational components, no injected data services                           |
| `type:data-access` | frontend state (NgRx), HTTP clients, facades                                   |
| `type:api`         | Nest controllers, resolvers, DTOs — the backend request surface                |
| `type:services`    | Nest injectable providers: business logic, orchestration                       |
| `type:infra`       | DB schema, connection factories, external service clients                      |
| `type:models`      | wire contracts: zod schemas + inferred types, shared FE/BE source of truth     |
| `type:types`       | pure type-only exports; zero runtime, zero deps                                |
| `type:utils`       | stateless isomorphic helpers                                                   |
| `type:testing`     | test helpers, mocks, fixtures, builders                                        |
| `type:plugin`      | Nx generators / executors                                                      |

**`domain:<name>`** — product domain.

| value              | meaning                                                                           |
| ------------------ | --------------------------------------------------------------------------------- |
| `domain:shared`    | not tied to a product domain; importable by any domain                            |
| `domain:<product>` | belongs to one product domain; **defined by that domain's own ADR**, not this one |

No product domains exist yet, so `domain:shared` is the only value in play. Each new
product domain is introduced by a short ADR that records its `domain:` value, what it
owns, and its `depConstraints` row(s).

### Constraint matrix

`platform:` and `domain:` axes:

| sourceTag           | may depend on                                           | also                                        |
| ------------------- | ------------------------------------------------------- | ------------------------------------------- |
| `platform:backend`  | `platform:backend`, `platform:shared`                   |                                             |
| `platform:frontend` | `platform:frontend`, `platform:shared`                  | bans `zod`, `zod/v4` (ADR 0003)             |
| `platform:shared`   | `platform:shared`                                       | bans `zod`, `zod/v4` (ADR 0003)             |
| `platform:tools`    | `platform:tools`, `platform:shared`, `platform:backend` | tooling may run backend-side ops; not v.v.  |
| `domain:shared`     | `domain:shared`                                         | product-domain rows added by their own ADRs |

`type:` axis:

| sourceTag          | may depend on                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| `type:app`         | `api`, `core`, `data-access`, `feature`, `infra`, `models`, `services`, `testing`, `types`, `ui`, `utils` |
| `type:e2e`         | `e2e`, `models`, `testing`, `types`, `utils`                                                              |
| `type:api`         | `api`, `services`, `models`, `types`, `utils`                                                             |
| `type:services`    | `services`, `infra`, `models`, `types`, `utils`                                                           |
| `type:infra`       | `infra`, `types`, `utils`                                                                                 |
| `type:core`        | `data-access`, `models`, `testing`, `types`, `ui`, `utils`                                                |
| `type:feature`     | `data-access`, `models`, `testing`, `types`, `ui`, `utils`                                                |
| `type:data-access` | `data-access`, `models`, `types`, `testing`, `utils`                                                      |
| `type:ui`          | `ui`, `testing`, `types`, `utils`                                                                         |
| `type:models`      | `models`, `types`, `utils`                                                                                |
| `type:utils`       | `types`, `utils`                                                                                          |
| `type:types`       | `types`                                                                                                   |
| `type:plugin`      | `plugin`, `types`, `utils`                                                                                |
| `type:testing`     | any `type:*` **except** `type:app` and `type:e2e`                                                         |

### How the rule reads these (verified against `@nx/eslint-plugin` 23.1.1)

- **AND semantics.** A project's tags select _every_ matching `depConstraints` entry, and
  an import must satisfy all of them. A `platform:backend` + `type:services` + `domain:shared`
  lib is checked against all three rows on every import. Order in the array does not
  matter.
- **No catch-all.** There is no `{ sourceTag: '*' }` entry, so a project whose tags match
  no constraint fails outright (`projectWithoutTagsCannotHaveDependencies`) the moment it
  has a dependency. Tagging is mandatory, not merely encouraged.
- **`onlyDependOnLibsWithTags` has no negation.** A leading `!` is read as a literal tag
  name and matches nothing. Exclusions use the sibling `notDependOnLibsWithTags` key
  (which is also transitive-aware) — that is why `type:testing` uses it for `type:app` /
  `type:e2e`.
- **`bannedExternalImports` is exact-match** unless it contains a wildcard, and only
  direct imports are checked (`checkNestedExternalImports` is off by default) — this is
  why the zod ban has to sit on `platform:shared` and not only `platform:frontend` (ADR 0003).
- **Static imports of lazy-loaded libs are flagged automatically.** Once any project
  reaches a lib through `loadChildren` / dynamic `import()`, a static import of that same
  lib from the same source is a separate error (`noImportsOfLazyLoadedLibraries`) — this
  is what keeps `type:feature` boundaries lazy without extra config.
- **The rule runs on all TS/JS extensions.** The block is scoped to
  `**/*.{ts,tsx,cts,mts,js,jsx,cjs,mjs}` (wider than Nx's generated default of
  `.ts/.tsx/.js/.jsx`) so `.mts` / `.cts` lib source is covered too. Files outside any
  project (root config files) resolve to no source project and are skipped.

### Locked parameters

- **Three axes, always — exactly one tag each.** Every project carries one `platform:`, one
  `type:`, and one `domain:` tag. Omitting one is not allowed — use `platform:shared` /
  `type:utils` / `domain:shared` if nothing more specific fits. Two tags on one axis is
  not a shorthand: the rule applies both rows and a project may only depend on the
  intersection, which is almost never what you want.
- **`platform:` and `type:` value sets are closed.** Adding, removing, or renaming a value
  requires reopening this ADR.
- **`domain:` values grow by ADR.** `domain:shared` is fixed here; every `domain:<product>`
  value and its constraint row is added by that domain's own ADR.
- **No `*` catch-all constraint** — keep tagging mandatory.
- **`enforceBuildableLibDependency: true`** — a buildable lib may not depend on a
  non-buildable one.
- **Constraint rows change only by reopening this ADR** (or, for `domain:<product>` rows,
  the ADR that owns that domain).
- **Testing libs are scoped `platform:frontend` or `platform:backend`, never `platform:shared`** —
  a mock is environment-specific, and the `platform:` row then keeps it from crossing.

### Deliberate design choices worth stating

- **`type:core` is eager, `type:feature` is lazy.** `type:core` holds what the Angular app
  must load at bootstrap (root providers, config, guards, interceptors); `type:feature`
  holds routed areas the app pulls in on demand via `loadChildren`. `type:core` therefore
  cannot depend on `type:feature` — an eager lib statically importing a lazy one would
  defeat the split, and `@nx/enforce-module-boundaries` flags a static import of a lib
  that is loaded dynamically elsewhere.
- **`type:feature` and `type:core` have no self-reference** — features cannot statically
  compose sub-features (each is its own lazy boundary); `type:core` is one lib per app.
  Shared behavior moves down to `data-access` / `ui` / `utils`.
- **`type:ui` cannot import `type:models`** — presentational components type their inputs
  against `type:types`, not the zod-inferred wire contracts, keeping the view layer
  decoupled from the transport shape.
- **`type:infra` cannot import `type:models`.** The persistence shape (drizzle schema,
  `$inferSelect` row types) and the wire contract are separate representations that drift
  apart in practice. `type:services` is the only layer that touches both and maps row ↔
  DTO; `type:infra` needs only `type:types` and `type:utils`. Shape primitives shared
  between infra and models live in `type:types`.
- **`type:app` may import `type:infra`** — a deliberate hole in the api/services/infra
  layering, for the Nest application's own composition root (module wiring). `type:api`
  still may not; it reaches persistence only through `type:services`.
- **`platform:tools` may reach into `platform:backend`, not the reverse** — some tooling runs
  backend-side operations (codegen against schemas, migration helpers), so it needs to
  import backend libs. `platform:backend` has no `platform:tools` in its list, so application
  code can never pull a generator or executor into a running service.
- **`type:core` is not pinned to `platform:frontend` by a rule** — it is Angular-only by
  convention, but the `platform:` axis blocks a mis-tagged `type:core` lib from reaching
  frontend-only libs anyway.

## Consequences

### Positive

- Layering and environment violations fail `nx lint` before review.
- A project's three tags document its place in the architecture.
- A new rule is a one-line `depConstraints` edit that applies workspace-wide.
- Product domains are isolated the moment their rows land — cross-domain use has to go
  through `domain:shared` or a published contract.

### Negative / risks

- Every project needs three correct tags at creation. A mis-tag (e.g. `platform:shared` on
  what is really frontend-only code) silently widens that project's boundary.
- Inert until a project has a `lint` target and CI runs it — there are no projects yet, so
  the matrix is **unverified against a real graph**. First real projects should include a
  deliberate pass/fail check.
- The `type:` catalog assumes Angular + NestJS. A third stack (a CLI, a worker runtime)
  would need new `type:` values and a reopen.
- `notDependOnLibsWithTags` is transitive — a `type:testing` lib that pulls in anything
  which itself reaches a `type:app` will fail, which can be surprising.

## More information

- `eslint.config.mjs` — the `@nx/enforce-module-boundaries` block.
- ADR 0003 (`frontend-bundle-hygiene`) — the zod / lodash external-import bans that ride
  the `platform:frontend` and `platform:shared` constraint rows.
- ADR 0005 (`application-frameworks`) — records Angular + NestJS as the application stacks
  this catalog is built around, and the path-alias TypeScript layout they run on.
- ADR 0006 (`typed-linting`) — the workspace's type-aware ESLint policy. Separate
  mechanism: it rides `parserOptions`, not `depConstraints`, and does not touch the tag
  matrix.
- `docs/agents/conventions.md` §7 — when a decision warrants an ADR.
- Nx docs: "Enforce Module Boundaries" and the `@nx/enforce-module-boundaries` rule
  options (`onlyDependOnLibsWithTags`, `notDependOnLibsWithTags`, `bannedExternalImports`,
  `enforceBuildableLibDependency`, `checkNestedExternalImports`).

## Amendment (2026-10-17): environment-agnostic testing libs may be `platform:shared`

- Status: accepted
- Deciders: djmcgrath
- Implemented by: `jest-testing` (`libs/shared/jest/testing`, tagged `domain:shared`,
  `platform:shared`, `type:testing`); the `type:testing` comment in `eslint.config.mjs`;
  issue #158

The locked parameter "Testing libs are scoped `platform:frontend` or `platform:backend`, never
`platform:shared`" rests on "a mock is environment-specific". That holds for a double of an
Angular service or a Nest provider, but not for every test helper. `lastCallArg` (added to
`nx-testing` in #157) only reads a Jest mock's `mock.calls`: it imports nothing and runs the
same in a browser-environment spec as in a Node one. Under the old rule it could only live in
a `platform:backend` or `platform:tools` lib, which frontend specs may not import. ADR 0009 already
describes `type:testing` as spanning all three platforms, the same as `type:utils`, so the two
ADRs disagreed.

### Considered options

1. **Leave general-purpose helpers in `nx-testing`** (`platform:tools`) until a spec outside
   `tools/` needs one. No change now, but the first frontend consumer forces this decision
   anyway, and the helper keeps an Nx name it has nothing to do with.
2. **Move them to a `platform:backend` testing lib.** Allowed today, since `platform:tools` may import
   `platform:backend`, but frontend specs still couldn't use it.
3. **Allow `platform:shared` testing libs for environment-agnostic helpers.** **(chosen)**

### Decision

- **The locked parameter is replaced by:** a testing lib takes the `platform:` of the code its
  helpers are tied to: `platform:frontend` for Angular doubles, `platform:backend` for Node and Nest
  ones, `platform:tools` for helpers built on Nx devkit types. A lib whose helpers work in any
  environment is `platform:shared`.
- **No `depConstraints` row changes.** The `platform:shared` row already limits such a lib to other
  `platform:shared` libs and carries the zod ban, so an environment-specific import fails
  `nx lint` there just as it does for a `platform:shared` util. Only the `type:testing` comment in
  `eslint.config.mjs` changes.
- **The first such lib is `jest-testing`** (`libs/shared/jest/testing`, ADR 0009 layout). It is
  for helpers that need nothing but Jest's own mock shape. `lastCallArg` moves there from
  `nx-testing`, and `nx-testing` no longer exports it.

### Consequences

- **Positive:** frontend, backend and tools specs share one copy of each general-purpose helper.
  ADR 0004 and ADR 0009 now agree that `type:testing` spans every platform.
- **Negative / risk:** "works in any environment" is a judgement made when a helper is added,
  and lint catches only imports, not runtime use. A helper that touches a Node global (`process`,
  `Buffer`) without importing anything would pass lint in a `platform:shared` lib and fail only in
  a browser-environment spec. Keep `platform:shared` testing helpers to plain JavaScript and Jest's
  own APIs.
- **Update (2026-10-19, #164):** `typecheck` now also checks each project's `tsconfig.lib.json`,
  and no `platform:shared` lib's lib tsconfig loads `node` types, so a Node global in their source
  fails `typecheck` and CI. A `node --test` guard (`.github/scripts/shared-lib-types.test.cjs`)
  keeps `node` out of every `platform:shared` lib's lib tsconfig, including new ones.

## Amendment (2026-10-20): the backend stack changed — see ADR 0017

- Status: accepted
- Deciders: djmcgrath
- Implemented by: ADR 0017 (`dotnet-backend`); issue #194

The backend is **ASP.NET Core on .NET**, not NestJS (ADR 0017 supersedes the backend half
of ADR 0005). This matrix was written around Angular + NestJS; what follows is what that
changes here.

### Tag names are unchanged

No `platform:` or `type:` value is added, removed or renamed, so the "value sets are closed"
rule above is **not** reopened. Three descriptions are reworded and one changes meaning:

- `platform:backend` — read "Node only (NestJS)" as **".NET only (ASP.NET Core)"**.
- `type:app` — read "(Angular or Nest)" as **"(Angular or ASP.NET Core)"**.
- `type:api` / `type:services` — read Nest's "controllers, resolvers, DTOs" and "injectable
  providers" as the **ASP.NET Core** equivalents. The architectural roles are identical.
- `type:models` **changes meaning**: it is no longer a hand-written zod wire contract shared
  by frontend and backend, but the **generated TypeScript client lib** derived from the
  backend's OpenAPI document — `platform:frontend`, derived output, never hand-edited. ADR
  0003's zod bans are unaffected.

### The matrix is unenforced on the backend until a DIY check exists

`@nx/enforce-module-boundaries` reads **TypeScript imports only**. A C# `ProjectReference`
is invisible to it, and `@nx/dotnet` ships no boundaries rule of its own, so every `type:`
edge between backend .NET projects is currently unchecked. Nx Conformance would cover it but
is Nx Enterprise-only.

ADR 0017 chooses a **DIY check** over `type:` edges between backend .NET projects that reads
**this matrix** rather than restating it — the matrix stays the single source of truth, read
by the check instead of copied into it. Its feasibility is unverified until a real `.csproj`
exists.

### One open edge: `type:testing` may not depend on `type:app`

`WebApplicationFactory`-style ASP.NET integration tests need a reference to the app under
test, which this matrix forbids. ADR 0017 lists this as unverified with two options — keep
the host thin so tests target a referenced lib, or amend this matrix for that one edge. The
first .NET project decides; if the matrix changes, that is an amendment to this ADR.

## Amendment (2026-10-22): the matrix lives in `nx-utils`, and the .NET check reads it there

- Status: accepted
- Deciders: djmcgrath
- Implemented by: issue #195 (the .NET boundary check) and #216 (moving the matrix)

The `depConstraints` matrix is no longer inlined in `eslint.config.mjs`. It is
`DEP_CONSTRAINTS` in `tools/nx/utils/src/lib/nx-dep-constraints.const.mts`, with the same
rows and comments, and its `DependencyConstraint` type lives in `nx-types`. ADR 0017's .NET
boundary check reads the same array, so the matrix stays the single source of truth.

### Two routes to the matrix, and why

- **The ESLint config** imports the file by relative path. Bare Node loads it with type
  stripping, which is why it is an `.mts` file that avoids value imports.
- **Everything else**, including the .NET check in `dotnet-plugin`, imports `DEP_CONSTRAINTS`
  from the `nx-utils` barrel (see the 2026-11-10 amendment below; until then it called a
  `loadDepConstraints()` function that `require`d the file by absolute path). The matrix could not
  be imported by name at first. Jest did not transform `.mts` files, so a barrel that re-exported
  it would make every spec that imports the barrel fail with `SyntaxError: Unexpected token 'export'` (seen in
  `nx-plugin` and `js-plugin`). And the transpiler Nx runs plugins and executors with rewrites an
  import of a path alias that points at the `.mts` file into a relative path with no extension,
  which Node cannot find (seen when running the executor under Nx). An earlier version of this
  amendment used a `@cybertecpty/nx-utils/dep-constraints` path alias for this, and it failed
  under Nx for that reason.

The loader existed because of the test runner and that transpiler. See the 2026-11-10 amendment.

### What the .NET check covers

The check applies every row of the matrix, whatever its tag axis (`platform:`, `type:` or
`domain:`), to the edges between a .NET project and the .NET projects it references. For each
row whose source tags the project has, the referenced project must have at least one of the
row's `onlyDependOnLibsWithTags` and none of its `notDependOnLibsWithTags`. The latter applies
to direct references only: a `type:testing` project that references a `type:app` project fails
for .NET, as it does for TypeScript. Unlike ESLint it does not follow references through other
projects. As in ESLint, a .NET project that no row applies to fails the check, and implicit
dependencies (from `implicitDependencies`, not a `ProjectReference`) are not checked.

Because every axis is checked, each `project.json` beside a `.csproj` needs its `platform:` tag as
well as `type:` and `domain:`. For edges between .NET projects the `platform:` rows are met
automatically, since every .NET project is `platform:backend`.

That makes the open edge above bite for .NET integration tests. The first attempt is to keep
the host thin so tests reference a library, not the app; ADR 0017's 2026-10-21 amendment records
that decision and the fallback if it does not work. ADR 0019 records the design of the check as
a whole and the alternatives it was weighed against.

## Amendment (2026-10-27): an app may depend on any domain, and a domain needs no ADR of its own

- Status: accepted
- Deciders: djmcgrath
- Implemented by: issue #229

The matrix above isolates product domains: a project of one domain may depend on its own domain
and `domain:shared`. An app is the composition root of a product, which can span several domains,
so it cannot live inside one domain's isolation.

A new domain also stops needing an ADR of its own, which this ADR required ("defined by that
domain's own ADR" above, and the locked parameter "`domain:` values grow by ADR").

### Considered options

1. **Keep every project isolated to its domain.** An app could then import only its own domain's
   libs, so the Gamer's Source frontend and API could not compose libs of the other domains.
2. **Tag the app `domain:shared`.** Rejected: `domain:shared` may depend only on `domain:shared`,
   which is stricter, and the app would be tagged with a domain it does not belong to.
3. **Let an app depend on any domain.** **(chosen)**

### Decision

- **An app may depend on any `domain:*` project.** The matrix row is a plain row on the app's domain
  (`domain:gamers-source`), with `domain:*` as the allowed tag. Libs keep their own domain isolation.
- **Rows only restrict, so the app row restricts nothing.** It keeps the exemption visible. The
  consequence is that a domain should not mix apps and libs: an isolation row for the libs would
  also bind the apps, and nothing could loosen it again. Today each domain is one or the other, so
  plain rows suffice. If a domain ever needs both, give its libs combo rows (`allSourceTags` with the
  lib's `type:`) so that the apps are not matched.
- **`domain:*` is accepted** by `@nx/enforce-module-boundaries` in `onlyDependOnLibsWithTags`
  (the existing `type:*` row on `type:testing` already relies on it), and the .NET check applies
  the same match. `nx-dep-constraints.utils.spec.ts` tests the .NET side, and `check-boundaries`
  exercises the real row, since `gamers-source-api` references a lib of another domain. No
  TypeScript project crosses domains yet, so the ESLint side is not exercised until one does.
- **Why this is acceptable:** the repo has one product, made of several domains. The row is
  narrowed when a second product arrives.
- **A new `domain:<product>` value needs no ADR.** It is added by tagging its projects and adding
  its row to `DEP_CONSTRAINTS`, with a comment above it saying what the domain owns. That
  module is the list of domains: `domain:shared`, `domain:gamers-source` (the product's apps) and
  `domain:gaming-collection` (which games a user owns, plays and wants). An ADR is for a domain
  whose boundaries are a real choice, such as splitting one or changing how domains relate.
  Adding a domain applies this ADR's tag system, is cheap to reverse (a tag and a row), and an ADR
  for it would restate the comment on its rows.

### Open edge: `type:testing` and `type:app`

The thin host held. `gamers-source-api` holds no logic, and maps the endpoints of
`libs/gaming-collection/api` (another domain), and that lib's tests project references the lib, not
the app. The matrix is unchanged. Tests that boot the host (`WebApplicationFactory`) would still need a
reference to the app, and remain unverified.

## Amendment (2026-10-28): `type:services` returns domain types on .NET; the API library maps them to DTOs

- Status: accepted
- Deciders: djmcgrath
- Implemented by: issue #238; see ADR 0020 (`rest-api-conventions`)

The boundary above says `type:services` "is the only layer that touches both and maps row ↔ DTO". That
assumed shared zod contracts in `type:models`, which the 2026-10-20 amendment replaced with a client
generated from the backend's OpenAPI document. For .NET it no longer holds.

A `type:services` project may not depend on a `type:api` project, and the wire types (DTOs) live in
the API library. So a service cannot return a DTO. **Service libraries return domain types, and the
API library maps them to DTOs.** A service library never references an API library; the API library
references the service library. ADR 0020 records the layout of an API library.

## Amendment (2026-11-10): the barrel exports the matrix, and the loader is gone

- Status: accepted
- Deciders: djmcgrath
- Implemented by: issue #223

The 2026-10-22 amendment kept the matrix out of the `nx-utils` barrel because Jest could not load
an `.mts` file and the transpiler Nx runs executors with broke an import of it. Both limits were
re-tested after the Vitest migration (ADR 0018):

- **Vitest** transforms the `.mts` file itself, so a barrel that re-exports it no longer breaks the
  specs that import the barrel. `typecheck`, `test` and `build` pass for `nx-utils` and
  `dotnet-plugin`.
- **The Nx transpiler** loads the executor with the barrel import in place. The barrel exports the
  matrix as `./lib/nx-dep-constraints.const.mjs`, and `nx run {project}:check-boundaries` against the
  workspace's .NET projects passes on a clean reference and fails on a forbidden one (a tests
  project referencing an app of another domain).

`dotnet-plugin` still ran Jest after #206, and a Jest spec that imports the barrel fails on the
`.mts` export, so this change moves `dotnet-plugin` to Vitest first. Its executor spec now runs
against the real matrix.

So `loadDepConstraints()` and `DEP_CONSTRAINTS_PATH` are removed. `nx-utils` exports
`DEP_CONSTRAINTS` and the executor imports it by name. The ESLint config still imports the file by
relative path, because bare Node loads it without the workspace's path aliases.

## Amendment (2026-11-10): the testing lib is `vitest-testing` (#208)

- Status: accepted
- Deciders: djmcg
- Implemented by: issue #208; ADR 0018

The 2026-10-17 amendment names `jest-testing` at `libs/shared/jest/testing`. ADR 0018 renamed it
to `vitest-testing` at `libs/shared/vitest/testing`, and `lastCallArg` now reads a `vi.fn()` mock's
`mock.calls`. The tags and the `platform:shared` reasoning are unchanged, and "plain JavaScript and
Jest's own APIs" now reads "plain JavaScript and Vitest's own APIs".

The 2026-11-10 barrel amendment's remark that `dotnet-plugin` still ran Jest is history: no project
runs Jest any more.

## Amendment (2026-11-10): `type:ui` may not import `@angular/common/http`

- Status: accepted
- Deciders: djmcg
- Implemented by: issue #315

`type:ui` is "presentational components, no injected data services", and its row already keeps it
off `type:data-access`. Nothing stopped a UI lib importing Angular's HTTP layer directly, which
would put transport code in the view layer.

### Decision

- **The `type:ui` row carries `bannedExternalImports: ['@angular/common/http']`**, the mechanism ADR
  0003 uses for the zod ban. The ban is on the entry point, not on `HttpClient`: the rule matches a
  module specifier and cannot filter by imported name, and a name-based ban would miss
  `provideHttpClient`, `HttpClientModule`, interceptors and `httpResource`, which share the entry
  point. Transport belongs in `type:data-access`.
- **The match is exact.** `@angular/common/http/testing` is not banned, and specs have the boundary
  rule switched off anyway.
- **`import type` is banned too.** Checked against `@nx/eslint-plugin` 23.1.1: the banned-import check
  does not look at the import kind (only the lazy-load check skips `import type`), so
  `import type { HttpErrorResponse }` in a UI lib fails. A UI lib types its inputs against
  `type:types`.

### Consequences

- **Direct imports only.** `checkNestedExternalImports` is off, so a `type:ui` lib can still reach
  HTTP through a `type:utils` lib that imports it. Turning it on is a workspace-wide change and is not
  made here.
- **Unverified on a real graph.** No `type:ui` lib exists and Angular is not a dependency yet, so the
  rule is covered by a spec on the row (`nx-dep-constraints.const.spec.ts`), not by a lint failure.
  The first `type:ui` lib should include a deliberate pass/fail check.

## Amendment (2026-11-10): `checkNestedExternalImports` stays off — it cannot match a workspace lib's imports

- Status: accepted
- Deciders: djmcg
- Implemented by: issue #319

The two amendments and ADR 0003 leave one gap: `bannedExternalImports` checks a project's own direct
imports, so a banned package still reaches a project through a workspace lib that imports it (a
`type:ui` lib to `@angular/common/http` through a `type:utils` lib, or `platform:frontend` code to
zod's classic API). `checkNestedExternalImports` is the rule's option for that. Issue #319 asked
whether to turn it on.

### Considered options

1. **Turn it on.** It reported no violation across the projects with a `lint` target, so enabling it
   appeared to cost nothing today.
2. **Leave it off and record why.** **(chosen)**

### Decision

- **The option stays off.** In `@nx/eslint-plugin` 23.1.1 it cannot report anything for an import of a
  workspace lib. The nested check collects the external packages reachable from the imported lib, then
  tests each against the constraint with the import specifier of the _workspace lib_
  (`@cybertecpty/playwright-testing`), not the package's own. That test returns `false` unless the
  specifier is the package name or starts with it, so the two never match.
- **The trial shows the same.** The graph holds the edge `cybertec-io-e2e` (`platform:frontend`) to
  `playwright-testing`, which imports `lighthouse`. With `lighthouse` added to the `platform:frontend`
  row's `bannedExternalImports` and the option on, `nx lint cybertec-io-e2e` still passed. The zero
  violations of the real trial therefore says nothing about the workspace, and enabling the option
  would pass silently while checking nothing, which is worse than no check.
- **The gap stays open.** It is narrow today: of the projects the bans apply to, only
  `cybertec-io-e2e` imports another workspace lib, and no `type:ui` lib exists. Layer rules narrow it
  further: `type:ui` may depend only on `type:ui`, `type:testing`, `type:types` and `type:utils`, and
  `type:types` depends only on other `type:types` libs. The remaining routes are a `type:utils` lib
  that imports a banned entry point, and a `type:testing` lib, which may depend on almost any
  `type:*` lib and so reaches a banned import through one of those. Review must catch both until
  something does.

### Consequences

- **The notes that the option "is off" (ADR 0003 and above) and the line in the `@angular/common/http`
  amendment that turning it on "is a workspace-wide change" do not describe a working check.** Read
  them as "the rule has no working transitive check", not as a setting to flip.
- **Revisit on an Nx upgrade.** Re-run the `lighthouse` experiment above against a newer
  `@nx/eslint-plugin`. If the nested ban fires, enable the option and amend this ADR and ADR 0003. If
  the gap starts to matter first, a check over the project graph is the other way to close it, the
  approach ADR 0019 takes for .NET edges.

## Amendment (2026-11-10): `type:utils` and `type:types` may not import `@angular/common/http`

- Status: accepted
- Deciders: djmcg
- Implemented by: issue #323

The `checkNestedExternalImports` amendment leaves a `type:ui` lib able to reach `@angular/common/http`
through a lib it may depend on. `type:ui` may depend on `type:utils` and `type:types` libs, and the
rule checks only a lib's own imports, so a `type:utils` lib that imports the entry point passes lint
and is then importable from a UI lib. ADR 0003 closes the same kind of gap for zod by banning it on
`platform:shared` as well as `platform:frontend`, so the ban moves to the libs a UI lib reaches.

### Considered options

1. **A combo row for `platform:frontend` and `type:utils`.** Rejected: utils are the libs most likely to
   be `platform:shared`, and a `platform:shared` util would not match the row, though a UI lib can import it.
2. **The bare `type:utils` and `type:types` rows.** **(chosen)** A row on the bare tag binds a lib of
   every platform.
3. **Also ban it on `type:testing`.** Rejected: a frontend testing lib may import `HttpClient` to
   build a stub, which is a legitimate use.

### Decision

- **The `type:utils` and `type:types` rows carry `bannedExternalImports: ['@angular/common/http']`**,
  the same entry point and mechanism as the `type:ui` row. Utils are stateless isomorphic helpers
  and `type:types` libs are pure type-only exports, so neither has a use for Angular's HTTP layer.
- **`import type` is banned here too**, for the reason in the `type:ui` amendment, which is the case
  that matters for `type:types`, since it has no runtime code.
- **`type:testing` is not banned.** The route from `type:ui` through a testing lib stays open: a
  testing lib may import the entry point, and `type:testing` may depend on almost any `type:*` lib,
  so a banned import can reach a UI lib through one. Review must catch it until a working transitive
  check exists.

### Consequences

- **A `type:ui` lib can no longer reach the entry point through `type:utils` or `type:types`.** The
  `type:testing` route is the one left, as above. The `type:utils` route named as open in the
  `checkNestedExternalImports` amendment and the "direct imports only" note in the
  `@angular/common/http` amendment are closed by this change.
- **A `type:utils` or `type:types` lib that needs Angular's HTTP layer is mis-tagged.** Transport
  belongs in `type:data-access`, so move the code there.
- **Still unverified on a real graph.** No `type:ui`, Angular-using `type:utils` or `type:types` lib
  exists yet, so a spec on the matrix rows covers the rule, not a lint failure.

## Amendment (2026-11-10): the `scope:` tag is renamed `platform:`

- Status: accepted
- Deciders: djmcgrath
- Implemented by: issue #320 (code and config), issue #321 (docs, rules and ADRs)

The first tag axis is now `platform:`, and the generator flag is `--platform`. Both were `scope:` and
`--scope` before. "Scope" is overloaded in this repo (npm scope, Conventional Commit scope, "out of
scope"), and `platform` names the axis for what it is: the runtime platform the code targets. The
values (`frontend`, `backend`, `shared`, `tools`), their meanings and every `depConstraints` row are
unchanged, so this is a rename, not a decision to revisit.

- **Prose says "the `platform:` tag" on first use**, since the repo and solution are already called
  "platform".
- **Other ADRs that name the tag** (0003, 0005, 0008, 0009, 0010, 0011, 0012, 0016, 0017, 0018) are
  updated in place where they describe the current tag. Their decision history is not rewritten.
