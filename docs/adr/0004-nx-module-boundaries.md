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

ADR 0003 already put the first `depConstraints` entries in place (the `scope:frontend` /
`scope:shared` external-import bans for zod). This ADR defines the full tag vocabulary and
the complete constraint matrix those entries live in.

## Decision drivers

- Architectural violations should fail `nx lint`, not wait for a reviewer to notice an
  import.
- A project's tags should tell you where it sits without reading its code.
- One place to change a rule, applied across the whole workspace.
- Product domains isolated by default — sharing between them is a deliberate, reviewable
  act.
- The same tag axis (`scope:`) that answers "is this browser-reachable?" for ADR 0003
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

**`scope:<env>`** — runtime environment.

| value            | meaning                                                                                |
| ---------------- | -------------------------------------------------------------------------------------- |
| `scope:frontend` | browser only (Angular)                                                                 |
| `scope:backend`  | Node only (NestJS)                                                                     |
| `scope:shared`   | environment-agnostic; importable by both, so it must stay browser-safe                 |
| `scope:tools`    | workspace tooling (generators, executors, scripts); not importable by application code |

**`type:<role>`** — architectural role.

| value              | meaning                                                                        |
| ------------------ | ------------------------------------------------------------------------------ |
| `type:app`         | deployable application (Angular or Nest; `scope:` disambiguates)               |
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

`scope:` and `domain:` axes:

| sourceTag        | may depend on                                  | also                                        |
| ---------------- | ---------------------------------------------- | ------------------------------------------- |
| `scope:backend`  | `scope:backend`, `scope:shared`                |                                             |
| `scope:frontend` | `scope:frontend`, `scope:shared`               | bans `zod`, `zod/v4` (ADR 0003)             |
| `scope:shared`   | `scope:shared`                                 | bans `zod`, `zod/v4` (ADR 0003)             |
| `scope:tools`    | `scope:tools`, `scope:shared`, `scope:backend` | tooling may run backend-side ops; not v.v.  |
| `domain:shared`  | `domain:shared`                                | product-domain rows added by their own ADRs |

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
  an import must satisfy all of them. A `scope:backend` + `type:services` + `domain:shared`
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
  why the zod ban has to sit on `scope:shared` and not only `scope:frontend` (ADR 0003).
- **Static imports of lazy-loaded libs are flagged automatically.** Once any project
  reaches a lib through `loadChildren` / dynamic `import()`, a static import of that same
  lib from the same source is a separate error (`noImportsOfLazyLoadedLibraries`) — this
  is what keeps `type:feature` boundaries lazy without extra config.
- **The rule runs on all TS/JS extensions.** The block is scoped to
  `**/*.{ts,tsx,cts,mts,js,jsx,cjs,mjs}` (wider than Nx's generated default of
  `.ts/.tsx/.js/.jsx`) so `.mts` / `.cts` lib source is covered too. Files outside any
  project (root config files) resolve to no source project and are skipped.

### Locked parameters

- **Three axes, always — exactly one tag each.** Every project carries one `scope:`, one
  `type:`, and one `domain:` tag. Omitting one is not allowed — use `scope:shared` /
  `type:utils` / `domain:shared` if nothing more specific fits. Two tags on one axis is
  not a shorthand: the rule applies both rows and a project may only depend on the
  intersection, which is almost never what you want.
- **`scope:` and `type:` value sets are closed.** Adding, removing, or renaming a value
  requires reopening this ADR.
- **`domain:` values grow by ADR.** `domain:shared` is fixed here; every `domain:<product>`
  value and its constraint row is added by that domain's own ADR.
- **No `*` catch-all constraint** — keep tagging mandatory.
- **`enforceBuildableLibDependency: true`** — a buildable lib may not depend on a
  non-buildable one.
- **Constraint rows change only by reopening this ADR** (or, for `domain:<product>` rows,
  the ADR that owns that domain).
- **Testing libs are scoped `scope:frontend` or `scope:backend`, never `scope:shared`** —
  a mock is environment-specific, and the `scope:` row then keeps it from crossing.

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
- **`scope:tools` may reach into `scope:backend`, not the reverse** — some tooling runs
  backend-side operations (codegen against schemas, migration helpers), so it needs to
  import backend libs. `scope:backend` has no `scope:tools` in its list, so application
  code can never pull a generator or executor into a running service.
- **`type:core` is not pinned to `scope:frontend` by a rule** — it is Angular-only by
  convention, but the `scope:` axis blocks a mis-scoped `type:core` lib from reaching
  frontend-only libs anyway.

## Consequences

### Positive

- Layering and environment violations fail `nx lint` before review.
- A project's three tags document its place in the architecture.
- A new rule is a one-line `depConstraints` edit that applies workspace-wide.
- Product domains are isolated the moment their rows land — cross-domain use has to go
  through `domain:shared` or a published contract.

### Negative / risks

- Every project needs three correct tags at creation. A mis-tag (e.g. `scope:shared` on
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
  the `scope:frontend` and `scope:shared` constraint rows.
- ADR 0005 (`application-frameworks`) — records Angular + NestJS as the application stacks
  this catalog is built around, and the path-alias TypeScript layout they run on.
- ADR 0006 (`typed-linting`) — the workspace's type-aware ESLint policy. Separate
  mechanism: it rides `parserOptions`, not `depConstraints`, and does not touch the tag
  matrix.
- `docs/agents/conventions.md` §7 — when a decision warrants an ADR.
- Nx docs: "Enforce Module Boundaries" and the `@nx/enforce-module-boundaries` rule
  options (`onlyDependOnLibsWithTags`, `notDependOnLibsWithTags`, `bannedExternalImports`,
  `enforceBuildableLibDependency`, `checkNestedExternalImports`).

## Amendment (2026-10-17): environment-agnostic testing libs may be `scope:shared`

- Status: accepted
- Deciders: djmcgrath
- Implemented by: `jest-testing` (`libs/shared/jest/testing`, tagged `domain:shared`,
  `scope:shared`, `type:testing`); the `type:testing` comment in `eslint.config.mjs`;
  issue #158

The locked parameter "Testing libs are scoped `scope:frontend` or `scope:backend`, never
`scope:shared`" rests on "a mock is environment-specific". That holds for a double of an
Angular service or a Nest provider, but not for every test helper. `lastCallArg` (added to
`nx-testing` in #157) only reads a Jest mock's `mock.calls`: it imports nothing and runs the
same in a browser-environment spec as in a Node one. Under the old rule it could only live in
a `scope:backend` or `scope:tools` lib, which frontend specs may not import. ADR 0009 already
describes `type:testing` as spanning all three scopes, the same as `type:utils`, so the two
ADRs disagreed.

### Considered options

1. **Leave general-purpose helpers in `nx-testing`** (`scope:tools`) until a spec outside
   `tools/` needs one. No change now, but the first frontend consumer forces this decision
   anyway, and the helper keeps an Nx name it has nothing to do with.
2. **Move them to a `scope:backend` testing lib.** Allowed today, since `scope:tools` may import
   `scope:backend`, but frontend specs still couldn't use it.
3. **Allow `scope:shared` testing libs for environment-agnostic helpers.** **(chosen)**

### Decision

- **The locked parameter is replaced by:** a testing lib takes the `scope:` of the code its
  helpers are tied to: `scope:frontend` for Angular doubles, `scope:backend` for Node and Nest
  ones, `scope:tools` for helpers built on Nx devkit types. A lib whose helpers work in any
  environment is `scope:shared`.
- **No `depConstraints` row changes.** The `scope:shared` row already limits such a lib to other
  `scope:shared` libs and carries the zod ban, so an environment-specific import fails
  `nx lint` there just as it does for a `scope:shared` util. Only the `type:testing` comment in
  `eslint.config.mjs` changes.
- **The first such lib is `jest-testing`** (`libs/shared/jest/testing`, ADR 0009 layout). It is
  for helpers that need nothing but Jest's own mock shape. `lastCallArg` moves there from
  `nx-testing`, and `nx-testing` no longer exports it.

### Consequences

- **Positive:** frontend, backend and tools specs share one copy of each general-purpose helper.
  ADR 0004 and ADR 0009 now agree that `type:testing` spans every scope.
- **Negative / risk:** "works in any environment" is a judgement made when a helper is added,
  and lint catches only imports, not runtime use. A helper that touches a Node global (`process`,
  `Buffer`) without importing anything would pass lint in a `scope:shared` lib and fail only in
  a browser-environment spec. Keep `scope:shared` testing helpers to plain JavaScript and Jest's
  own APIs.
- **Update (2026-10-19, #164):** `typecheck` now also checks each project's `tsconfig.lib.json`,
  and no `scope:shared` lib's lib tsconfig loads `node` types, so a Node global in their source
  fails `typecheck` and CI. A `node --test` guard (`.github/scripts/shared-lib-types.test.cjs`)
  keeps `node` out of every `scope:shared` lib's lib tsconfig, including new ones.

## Amendment (2026-10-20): the backend stack changed — see ADR 0017

- Status: accepted
- Deciders: djmcgrath
- Implemented by: ADR 0017 (`dotnet-backend`); issue #194

The backend is **ASP.NET Core on .NET**, not NestJS (ADR 0017 supersedes the backend half
of ADR 0005). This matrix was written around Angular + NestJS; what follows is what that
changes here.

### Tag names are unchanged

No `scope:` or `type:` value is added, removed or renamed, so the "value sets are closed"
rule above is **not** reopened. Three descriptions are reworded and one changes meaning:

- `scope:backend` — read "Node only (NestJS)" as **".NET only (ASP.NET Core)"**.
- `type:app` — read "(Angular or Nest)" as **"(Angular or ASP.NET Core)"**.
- `type:api` / `type:services` — read Nest's "controllers, resolvers, DTOs" and "injectable
  providers" as the **ASP.NET Core** equivalents. The architectural roles are identical.
- `type:models` **changes meaning**: it is no longer a hand-written zod wire contract shared
  by frontend and backend, but the **generated TypeScript client lib** derived from the
  backend's OpenAPI document — `scope:frontend`, derived output, never hand-edited. ADR
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
- **Everything else**, including the .NET check in `dotnet-plugin`, calls `loadDepConstraints()`
  in `nx-utils`, which `require`s the file by absolute path. The matrix cannot be imported by
  name. Jest does not transform `.mts` files, so a barrel that re-exported it would make every
  spec that imports the barrel fail with `SyntaxError: Unexpected token 'export'` (seen in
  `nx-plugin` and `js-plugin`). And the transpiler Nx runs plugins and executors with rewrites an
  import of a path alias that points at the `.mts` file into a relative path with no extension,
  which Node cannot find (seen when running the executor under Nx). An earlier version of this
  amendment used a `@cybertecpty/nx-utils/dep-constraints` path alias for this, and it failed
  under Nx for that reason.

The loader exists because of the test runner and that transpiler. ADR 0018 moves the TypeScript
projects to Vitest, which transforms `.mts` files itself. After that migration, check whether
exporting the matrix from the barrel works and the loader can become a plain import.

### What the .NET check covers

The check applies every row of the matrix, whatever its tag axis (`scope:`, `type:` or
`domain:`), to the edges between a .NET project and the .NET projects it references. For each
row whose source tags the project has, the referenced project must have at least one of the
row's `onlyDependOnLibsWithTags` and none of its `notDependOnLibsWithTags`. The latter applies
to direct references only: a `type:testing` project that references a `type:app` project fails
for .NET, as it does for TypeScript. Unlike ESLint it does not follow references through other
projects. As in ESLint, a .NET project that no row applies to fails the check, and implicit
dependencies (from `implicitDependencies`, not a `ProjectReference`) are not checked.

Because every axis is checked, each `project.json` beside a `.csproj` needs its `scope:` tag as
well as `type:` and `domain:`. For edges between .NET projects the `scope:` rows are met
automatically, since every .NET project is `scope:backend`.

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

- **A `type:app` project may depend on any `domain:*` project.** The matrix row is a combo row on
  the app's own tags (`type:app` and `domain:gamers-source`), with `domain:*` as the allowed tag.
  Libs keep their own domain isolation.
- **Rows only restrict, so isolation rows are combo rows too.** A plain `domain:gamers-source` row
  would apply to the app and cancel the exception. Each lib `type:` in a domain gets its own combo
  row, added with the first lib of that type.
- **`domain:*` is accepted** by `@nx/enforce-module-boundaries` in `onlyDependOnLibsWithTags`
  (the existing `type:*` row on `type:testing` already relies on it), and the .NET check applies
  the same match. `nx-dep-constraints.utils.spec.ts` tests the .NET side, and `check-boundaries`
  exercises the real row, since `gamers-source-api` references a lib of another domain. No
  TypeScript project crosses domains yet, so the ESLint side is not exercised until one does.
- **Why this is acceptable:** the repo has one product, made of several domains. The row is
  narrowed when a second product arrives.
- **A new `domain:<product>` value needs no ADR.** It is added by tagging its projects and adding
  its combo rows to `DEP_CONSTRAINTS`, with a comment above them saying what the domain owns. That
  module is the list of domains: `domain:shared`, `domain:gamers-source` (the product's apps) and
  `domain:gaming-collection` (which games a user owns, plays and wants). An ADR is for a domain
  whose boundaries are a real choice, such as splitting one or changing how domains relate.
  Adding a domain applies this ADR's tag system, is cheap to reverse (a tag and a row), and an ADR
  for it would restate the comment on its rows.

### Open edge: `type:testing` and `type:app`

The thin host held. `gamers-source-api` holds no logic, and maps the endpoints of
`libs/gaming-collection/api` (another domain), which calls `libs/gaming-collection/services`. Each
lib's tests project references its own lib, not the app. The matrix is unchanged. Tests that boot the host (`WebApplicationFactory`) would still need a
reference to the app, and remain unverified.
