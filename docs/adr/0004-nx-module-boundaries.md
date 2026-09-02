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
- `docs/agents/conventions.md` §7 — when a decision warrants an ADR.
- Nx docs: "Enforce Module Boundaries" and the `@nx/enforce-module-boundaries` rule
  options (`onlyDependOnLibsWithTags`, `notDependOnLibsWithTags`, `bannedExternalImports`,
  `enforceBuildableLibDependency`, `checkNestedExternalImports`).
