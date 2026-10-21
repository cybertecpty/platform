# 17. ASP.NET Core as the backend stack, replacing NestJS

- Status: accepted (amended 2026-10-20: the TypeScript test runner is **Vitest**, not Jest —
  see ADR 0018. Every .NET decision here stands.)
- Date: 2026-10-20
- Deciders: djmcgrath
- Supersedes: the backend half of ADR 0005 (`application-frameworks`) — its Angular,
  TypeScript-layout, and pnpm decisions are untouched
- Implemented by: this ADR plus the dated amendments in ADRs 0004, 0005 and 0007, and
  the stack / test-runner / tag wording in `docs/agents/conventions.md`. The tooling
  (`@nx/dotnet`, `global.json`, `Directory.Build.props`, `.editorconfig`, CI
  `setup-dotnet`) and the removal of `@nx/nest` / `@nestjs/schematics` are separate
  tickets; issue #194

## Context and problem statement

ADR 0005 locks **NestJS** as the backend framework, and ADRs 0003, 0004 and 0007 are
written around that pairing — the `type:api` / `type:services` tags are described in
Nest's vocabulary, `type:models` is a zod wire contract shared between a TypeScript
frontend and a TypeScript backend, and ADR 0007's "one runner" argument rests on
`@nx/nest` only scaffolding Jest.

The backend is moving to **.NET (ASP.NET Core)** so the repo shows .NET paired with
Angular. The driver is the **job market for fullstack .NET + Angular**, not a technical
wall in Nest: Nest would work. That is an unusual reason to reverse an accepted ADR, which
is exactly why it needs recording — nothing in the code will explain it.

No NestJS application code exists. `packages/` holds no Nest project; the only trace is
the `@nx/nest` / `@nestjs/schematics` devDependencies and the generator defaults that
mention them. So this is a **documentation decision, not a migration**. Until it is
recorded, three accepted ADRs contradict the direction of travel and every follow-up
ticket has nothing to cite.

## Decision drivers

- **Career and job-market value of fullstack .NET + Angular.** Stated plainly because it
  is the whole reason: .NET + Angular is a common enterprise pairing, and the repo is the
  portfolio that demonstrates it. No technical deficiency in NestJS is being claimed.
- Decide while the workspace is empty of backend code — the same argument ADR 0005 made
  for fixing the TypeScript layout before any project depended on it.
- Keep every existing convention that does not actually depend on the backend being
  TypeScript: the three-axis tag system (ADR 0004), the lib and app layouts (ADRs 0009 /
  0010), the 80% coverage floor (ADR 0007), the frontend bundle bans (ADR 0003).
- A cross-language workspace must not grow a second way of doing anything that Nx already
  does once. Tags, project graph, `affected`, caching and CI stay the single mechanism.
- Don't pay for Nx Enterprise. Anything whose only implementation is an Enterprise feature
  has to be solved another way or dropped.
- The frontend must not lose its typed wire contract. Losing TypeScript on the backend
  loses the shared source of truth; something has to replace it.

## Considered options

### Backend stack

1. **ASP.NET Core (.NET).** **(chosen)**
2. **Stay on NestJS** — ADR 0005 as accepted. Technically fine; does not serve the driver.
3. **A third stack alongside Nest** (Nest kept, .NET added for new services). Rejected: two
   backend stacks is two sets of tooling, tags, CI wiring and conventions for a
   single-maintainer workspace, and ADR 0004's `type:` catalog would have to describe both.

### Nx integration

A. **The official `@nx/dotnet` plugin, with `dotnet new` for scaffolding.** **(chosen)**
B. **`@nx-dotnet/core`** — the established community plugin. Rejected: a first-party plugin
on the workspace's own Nx version is the same reasoning ADR 0005 used to pick
`@nx/angular` / `@nx/nest` over hand-wiring, and it tracks `nx migrate`.
C. **No plugin** — hand-written `project.json` targets shelling out to `dotnet`. Rejected:
it reimplements inference, dependency edges and caching by hand.

### API contract

A. **Code-first: ASP.NET Core emits OpenAPI, a generated TypeScript client lib is the
frontend's contract.** **(chosen)**
B. **Schema-first**: hand-written OpenAPI document as the source of truth, generating both
the C# server types and the TS client. Rejected: a third artifact to keep in sync, and it
gives up the compiler as the contract's author.
C. **Hand-written TypeScript client** against a documented API. Rejected: that is the drift
`type:models` existed to prevent — it just moves the hand-maintained duplicate.

### Backend module boundaries

A. **A DIY check over `type:` edges between backend .NET projects**, reading ADR 0004's
matrix. **(chosen)**
B. **Nx Conformance rules** — rejected: Nx Enterprise only, and this workspace is not on
Enterprise.
C. **Nothing — review only.** Rejected for the reason ADR 0004 rejected the same option:
drift is invisible until someone maps the graph.
D. **`.NET`-native layering tools** (NetArchTest, ArchUnitNET) as architecture tests.
Rejected as the primary mechanism: the rules would live in C# test code, duplicating
ADR 0004's matrix in a second place and a second language, and they cannot see Nx tags.

### .NET test runner

A. **xUnit with coverlet.** **(chosen)**
B. **NUnit** or **MSTest**. Rejected: xUnit is the default `dotnet new` test template and the
de facto standard for new ASP.NET Core work; nothing here needs the alternatives'
features.

### Lint and format

A. **Built-in Roslyn analyzers with warnings as errors, plus `dotnet format
   --verify-no-changes`.** **(chosen)**
B. **Third-party analyzers** (StyleCop.Analyzers, SonarAnalyzer, Roslynator). Rejected for
now: the built-in analyzer set is already substantial and ships with the SDK, so it costs
no dependency and no version pinning. Revisit only if a concrete gap appears.

### SDK version and upgrade cadence

A. **.NET 10 LTS, pinned by `global.json`, upgraded only on the next LTS.** **(chosen)**
B. **Track the newest SDK**, STS releases included. Rejected: an STS release is supported for
18 months, so the workspace would be forced onto a new major roughly every six months for
features nothing here needs — the opposite of the "track what the pinned plugin supports,
not latest" rule ADR 0005 applied to Angular and Nest.
C. **No `global.json`** — build on whatever SDK is installed. Rejected: the SDK version then
differs between a developer machine and CI silently, which is exactly the class of drift
`global.json` exists to close.

## Decision outcome

**The backend is ASP.NET Core on .NET, integrated through the official `@nx/dotnet`
plugin. ADR 0005's NestJS decision is superseded; its Angular and TypeScript-layout
decisions stand.**

### API contract — code-first, generated TypeScript client

- **ASP.NET Core is the source of truth.** The C# types and endpoints are authored first and
  the framework emits the OpenAPI document — code-first, not schema-first.
- **A generated TypeScript client lib replaces the zod-based `type:models`** as the
  frontend's contract. The frontend imports its request/response types and its HTTP calls
  from that lib, as it would have imported zod-inferred types before.
- That lib is **derived output**, tagged **`scope:frontend`**, and is **never hand-edited**.
  A change to the contract is a change to the C# code followed by a regeneration.
- **ADR 0003's zod bans stay exactly as they are.** `zod` and `zod/v4` remain banned on
  `scope:frontend` and `scope:shared`; `zod/mini`, `zod/v4/mini` and `zod/v4/core` remain
  allowed. The bans
  are about bundle size, not about where the contract comes from, so frontend-side
  validation written in zod is still written in `zod/mini`.

### Tooling — `@nx/dotnet` plus `dotnet new`

- **`@nx/dotnet`** is the integration: target inference, caching, and `affected` for .NET
  projects, pinned to the workspace Nx version like every other `@nx/*` package.
- **Scaffolding is `dotnet new`**, not an Nx generator. `@nx/dotnet` ships no project
  generators (documented, not observed — unverified item 0), so a new .NET project is created
  with the .NET CLI and then given the Nx
  metadata this ADR requires (`project.json` with explicit tags, placement per ADRs 0009 /
  0010, an entry in the root solution).
- **No Nx Enterprise, therefore no Nx Conformance.** Any rule that would have been a
  Conformance rule has to be solved with a checked-in script or dropped.

### Backend module boundaries — a DIY check

`@nx/dotnet` ships no module-boundaries rule (documented, not observed — unverified item 0),
and `@nx/enforce-module-boundaries` only reads
**TypeScript imports** — a C# `ProjectReference` is invisible to it. ADR 0004's matrix would
therefore go unenforced across the entire backend.

- **The chosen approach is a DIY check** that walks `type:` edges **between backend .NET
  projects** and fails on a disallowed edge, reading **ADR 0004's matrix** rather than
  restating it. **The matrix stays the single source of truth** — the check reads it rather
  than keeping a second copy. What that means mechanically (most likely: lifting the matrix
  out of `eslint.config.mjs` into a module both the ESLint config and the check import) is an
  implementation question for the ticket that builds it, not a decision here.
- Scope: backend-to-backend .NET edges. TypeScript-to-TypeScript edges stay with
  `@nx/enforce-module-boundaries`; there is no C#-to-TypeScript edge to check (the only link
  is the generated client, which is derived output).
- Where the check lives and how it runs is likewise left to that ticket; a `scope:tools`
  project with a CI target alongside `lint` is the obvious shape, given its feasibility is
  unverified.

### Tests — xUnit with coverlet

- **xUnit is the .NET test runner**, with **coverlet** for coverage.
- **An 80% floor, gated in CI only** — the same number and the same CI-only enforcement as
  ADR 0007's Jest `coverageThreshold` (`collectCoverage: !!process.env.CI`). The local inner
  loop stays fast; coverage is opt-in locally.
- **Test projects are separate `.csproj` files**, nested in a **`tests/` folder inside the
  project they test**, and tagged **`type:testing`**. One tested project, one `tests/` folder
  beside its source.
- **Jest remains the runner for Angular and TypeScript libs** (ADR 0007). This adds a second
  runner for a second language; it does not reopen ADR 0007's one-runner-per-language
  decision. The Astro/Vitest exception is likewise unchanged.

### Lint and format — built-in analyzers, warnings as errors

- **The SDK's built-in Roslyn analyzers are on and warnings are errors**, so an analyzer
  finding fails the build rather than scrolling past in a log.
- **`dotnet format --verify-no-changes`** is the format gate, the .NET counterpart of
  `nx format:check`. Formatting is checked, never auto-applied in CI.
- **No third-party analyzer packages.**

### Tags — names unchanged, backend descriptions reworded

Every `scope:` and `type:` **name** in ADR 0004 is unchanged. No tag is added, removed or
renamed, so ADR 0004's "value sets are closed" rule is not reopened — only the prose
describing three of them:

| tag             | was                                                        | now                                                             |
| --------------- | ---------------------------------------------------------- | --------------------------------------------------------------- |
| `scope:backend` | Node only (NestJS)                                         | .NET only (ASP.NET Core)                                        |
| `type:app`      | deployable application (Angular or Nest)                   | deployable application (Angular or ASP.NET Core)                |
| `type:api`      | Nest controllers, resolvers, DTOs                          | ASP.NET Core controllers / endpoints and DTOs                   |
| `type:services` | Nest injectable providers: business logic, orchestration   | .NET injectable services: business logic, orchestration         |
| `type:models`   | wire contracts: zod schemas + inferred types, shared FE/BE | the **generated TypeScript client lib** — derived, never edited |

`type:models` is the one semantic change: it stops being a hand-written contract shared by
both sides and becomes derived frontend output. It is `scope:frontend`, not `scope:shared`.

### Layout

- **.NET projects follow ADRs 0009 and 0010** — the same paths and derived names as any other
  project. A backend app is `apps/<name>`; a backend lib is
  `libs/<domain>[/<subdomain>...]/[<group>/]<type>`.
- **A `project.json` sits beside each `.csproj`**, carrying the three explicit tags. Tags are
  never inferred from the `.csproj`.
- **One root solution file** lists every .NET project.
- **Assembly name and root namespace are PascalCase**, derived from the project's kebab-case
  Nx name (`checkout-api` → `CheckoutApi`). The Nx project name stays kebab-case, as
  everywhere else.

### Locked parameters

- **Backend stack: ASP.NET Core on .NET. Frontend: Angular** (ADR 0005, unchanged).
- **.NET 10 LTS, pinned by `global.json`.** Upgrades happen **only on the next LTS** — no
  STS release is adopted. A move off LTS cadence requires reopening this ADR.
- **Angular and .NET are the only application stacks**, plus **Astro for static content
  sites** (ADR 0012, ADR 0005's 2026-09-23 amendment). A third application stack requires a
  new ADR and, per ADR 0004, possibly new `type:` values.
- **`@nx/dotnet` is the integration**, pinned to the workspace Nx version; `@nx-dotnet/core`
  is rejected. Adding .NET capability goes through the plugin and `dotnet new`, not
  hand-written targets.
- **No Nx Enterprise**, therefore no Nx Conformance rules anywhere in the workspace.
- **`type:models` is the generated client lib** — `scope:frontend`, derived, never
  hand-edited.
- **Test runners: xUnit (+ coverlet) for .NET, Jest for Angular and TypeScript libs**, Vitest
  for Astro sites. 80% coverage floor on both, CI-gated.
- **Warnings are errors** for .NET builds, and `dotnet format --verify-no-changes` gates
  formatting. No third-party analyzers.
- **Tag names are unchanged.** Only the descriptions above are reworded.

## Unverified until the first .NET project exists

Nothing in this ADR has been exercised against a real `.csproj` — there is none. The
following are **decisions taken on documented behaviour, not observed behaviour**. The first
.NET project in this workspace (a walking skeleton: one ASP.NET Core app, one backend lib,
one test project, one generated client) **confirms or corrects each of them**, and this ADR
gets a dated amendment either way.

0. **`@nx/dotnet`'s shape, before anything it does.** The plugin is not installed in this
   workspace — it is absent from `pnpm-lock.yaml` and `node_modules/@nx`. That it is
   first-party, that a release exists for the pinned workspace Nx version, that it ships **no
   project generators** (hence `dotnet new`), and that it ships **no module-boundaries rule**
   (hence the DIY check) are all read from its documentation, not observed here. Two of this
   ADR's choices rest on them, so this item is checked first: `pnpm add -D @nx/dotnet` at the
   pinned version, then read what the installed plugin actually provides.
1. **How `@nx/dotnet` assigns tags to a project.** This ADR requires a `project.json` beside
   each `.csproj` carrying the three explicit tags. Whether the plugin reads tags from there,
   infers its own, or ignores them is unverified.
2. **That `@nx/dotnet` turns `ProjectReference` into Nx dependency edges.** Documented, not
   yet observed here. The DIY boundary check, `affected`, and caching all depend on it.
3. **That the DIY boundary check is feasible** — that the edges it needs are in the project
   graph (item 2) and that ADR 0004's matrix can be read from a shared module by both the
   ESLint config and the check without duplicating it.
4. **That OpenAPI client generation works** end to end: ASP.NET Core emits a usable OpenAPI
   document, a generator turns it into a TypeScript client lib, and that lib satisfies
   ADR 0003's bundle rules and the frontend's needs.
5. **Whether ASP.NET integration tests can reference the host app.**
   `WebApplicationFactory`-style integration tests need a reference to the app under test,
   but ADR 0004's matrix says `type:testing` **may not depend on `type:app`**. Two options,
   neither chosen yet: **keep the host thin** so integration tests target a referenced lib
   rather than the app project, or **amend ADR 0004's matrix** for that one edge. The
   skeleton decides which.
6. **`@nx/dotnet` support for the .NET 10 SDK.** The plugin version pinned to the workspace
   Nx version has to work with .NET 10; if it does not, either the pin or the SDK version has
   to move, and this ADR records which.

## Consequences

### Positive

- The three ADRs that assumed a TypeScript backend no longer contradict the direction of
  travel, and follow-up tickets have something to cite.
- The driver is on the record. Someone reading the code later cannot derive "job market" from
  a `.csproj`, and without it this looks like an unmotivated reversal.
- The decision lands against **zero backend code** — the cheapest it will ever be, the same
  window ADR 0005 used for the TypeScript layout.
- Everything that did not actually depend on the backend's language is kept: tags, layout,
  the coverage floor, the frontend bans, the branch model, CI.
- The contract gains a compiler as its author: the TypeScript client cannot drift from the C#
  endpoints without a regeneration step that shows up in a diff.

### Negative / risks

- **The workspace becomes polyglot.** Two toolchains, two test runners, two format gates, two
  lint mechanisms, and a CI job that needs a .NET SDK as well as Node. Every future "how do we
  do X" question has two answers.
- **Module boundaries across the backend are now our own code to write and maintain** (the
  DIY check), where the frontend gets it from a maintained Nx rule. If the check is
  infeasible (unverified item 3), ADR 0004's matrix is simply unenforced on the backend.
- **The frontend's contract is now generated**, so it depends on a generation step being run
  and committed. A stale client compiles fine and fails at runtime — the regeneration has to
  be enforced somewhere (a CI check that regeneration is a no-op is the obvious candidate;
  not decided here).
- **One DI model across the stack is no longer a selling point** — it was an explicit driver in
  ADR 0005. Angular DI and .NET DI are similar in spirit but not the same thing, and the
  "one language" argument is gone outright.
- **`type:models` loses its shared source of truth.** The backend's DTOs and the frontend's
  client types are the same contract expressed twice, kept in sync by codegen rather than by
  the type system.
- **Everything in this ADR is unverified** (see the section above). The decisions are
  reasoned, not demonstrated, and the first real project is expected to correct some of them.
- `.NET 10` LTS-only upgrades mean up to a year behind the newest SDK features, by choice.

## More information

- ADR 0005 (`application-frameworks`) — the superseded NestJS decision; its Angular,
  path-alias TypeScript and pnpm decisions are unaffected. See its 2026-10-20 amendment.
- ADR 0004 (`nx-module-boundaries`) — the three-axis tag system and the constraint matrix this
  ADR rewords three descriptions of and proposes to enforce with a DIY check. See its
  2026-10-20 amendment.
- ADR 0007 (`jest-test-runner`) — Jest for Angular and TypeScript libs, the 80% CI-gated
  coverage floor this ADR mirrors for xUnit. See its 2026-10-20 amendment.
- ADR 0018 (`vitest-test-runner`) — supersedes ADR 0007's runner choice. The TypeScript
  runner named in this ADR's locked parameters is now Vitest; the 80% CI-gated floor this
  ADR mirrors for xUnit is unchanged.
- ADR 0003 (`frontend-bundle-hygiene`) — the zod and lodash entry-point bans, unchanged.
- ADRs 0009 / 0010 (`lib-directory-layout`, `app-directory-layout`) — the paths and derived
  names .NET projects follow.
- ADR 0012 (`astro-content-sites`) — the other non-Angular stack, and why it is an exception
  rather than a precedent.
- ADR 0011 (`release-flow`) — out of scope here; a .NET release path is its own decision.
- `docs/agents/conventions.md` §9, §11 — the stack, test-runner and tag wording updated to
  match this ADR.
- Nx docs: the `@nx/dotnet` plugin overview; Nx Conformance (Enterprise-only).
- .NET docs: `global.json` SDK pinning, the .NET support policy (LTS vs STS), ASP.NET Core
  OpenAPI support, `dotnet format`, and the SDK's built-in analyzer rule sets.

## Amendment (2026-10-20): the TypeScript test runner is Vitest — see ADR 0018

- Status: accepted
- Deciders: djmcgrath
- Implemented by: ADR 0018 (`vitest-test-runner`)

This ADR named **Jest** as the runner for Angular and TypeScript libs, and its 2026-10-20
amendment to ADR 0007 argued that nothing on the TypeScript side had changed. ADR 0018
reopens that on different grounds — **Angular 22 made Vitest its own default** and
deprecated Karma — and supersedes ADR 0007's runner choice. This amendment records what that
changes here.

### Superseded here

- **The locked parameter** "Test runners: xUnit (+ coverlet) for .NET, Jest for Angular and
  TypeScript libs, Vitest for Astro sites" — read it as **"xUnit (+ coverlet) for .NET,
  Vitest for every TypeScript project"**. Astro is no longer an exception, so the list is two
  runners, not three.
- **The "Tests — xUnit with coverlet" bullet** reading "**Jest remains the runner for Angular
  and TypeScript libs** (ADR 0007) … The Astro/Vitest exception is likewise unchanged" — read
  "Jest" as **"Vitest"**, and drop the Astro clause: there is no exception left to be
  unchanged.
- The **one-runner-per-language** principle that bullet asserted is **not** superseded. It
  still holds, and the count is still one runner per language. Only TypeScript's runner
  changed.

### Unchanged here

- **Every .NET decision**: xUnit with coverlet, the 80% floor gated in CI only, test projects
  as separate `.csproj` files in a `tests/` folder inside the project they test and tagged
  `type:testing`.
- **The coverage policy is still one number across both languages** — 80%, CI-gated — which
  was the point of mirroring ADR 0007 in the first place. ADR 0018 carries that policy
  forward verbatim onto Vitest.
- **The coverlet wiring consequence stands**: coverlet output still has to reach
  `.github/scripts/coverage-report.cjs` via `coverage/{projectRoot}` or .NET projects stay
  absent from the PR comment. Vitest's v8 provider writes the same report files Jest did, so
  that script is untouched on both sides.
- **Unverified item 5** (`type:testing` may not depend on `type:app`, which
  `WebApplicationFactory` integration tests need) is a tag-matrix question, not a runner
  question, and is unaffected.

### Consequences

- The "two test runners" count in Negative / risks above becomes accurate rather than
  understated: it was really three (Jest, Vitest for Astro, xUnit) and is now two.
- The `@nx/nest:library` generator-defaults entry this ADR orphaned is deleted by ADR 0018's
  migration rather than by the `@nx/nest` removal ticket — whichever lands first takes it.
