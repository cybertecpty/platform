# 18. Vitest as the TypeScript test runner, replacing Jest

- Status: accepted
- Date: 2026-10-20
- Deciders: djmcgrath
- Supersedes: ADR 0007 (`jest-test-runner`) — the runner choice and its
  `unitTestRunner: jest` locked parameters. ADR 0007's **coverage policy** (the 80% floor,
  CI-only collection, the reporting layer and its three amendments), `passWithNoTests`, the
  `type:types` exemption and `nx test {project}` as the entry point are **carried forward
  unchanged**, restated here against Vitest.
- Implemented by: (pending) the migration ticket for this ADR; `unitTestRunner: vitest` in
  the `nx.json` generator defaults, a root `vitest.shared.ts` replacing `jest.preset.js`,
  per-project `vitest.config.ts`, the ESLint plugin-layer inversion (ADR 0008), and
  `docs/agents/conventions.md` §9

## Context and problem statement

ADR 0007 chose **Jest everywhere**, and its 2026-10-20 amendment re-confirmed Jest for
Angular and TypeScript libs after the backend moved to .NET (ADR 0017), on the explicit
grounds that "one runner per language is still the goal, and **nothing has changed on the
TypeScript side**".

Something has. **Angular 22 moved its own unit testing to Vitest**: tests run through the
`@angular/build:unit-test` builder, Vitest is the default runner for new projects, Karma is
deprecated and takes no new features, and the v22 upgrade schematic prompts to migrate off
it. This workspace is on Angular 22 (`@angular-devkit/core ~22.0.4`).

That turns one of ADR 0007's own recorded risks from a single-generator annoyance into a
workspace-wide posture. ADR 0007 listed, under Negative / risks:

> This goes against the `@nx/js` scaffold default (Vitest), so it depends on the `nx.json`
> generator default being read. A lib generated in a context that ignores `nx.json`
> generator defaults gets Vitest, and the accidental toolchain returns.

With Angular 22, that is now true of **both** remaining TypeScript stacks. Staying on Jest
means holding two framework defaults off indefinitely, in a repo whose whole frontend is
Angular.

Two further facts make this the cheap moment:

- **The Astro exception is not implemented.** ADR 0007's 2026-09-23 amendment admits Vitest
  for Astro and accepts "two runners and two mock APIs in the tree" as its cost — but there
  is no `vitest.config.ts` in the workspace yet and no Astro spec. The split can still be
  avoided rather than paid for.
- **The TypeScript surface is small.** 13 projects with a `jest.config.cts`, 50 `*.spec.ts`
  files, 26 files touching `jest.fn` / `jest.mock` / `jest.spyOn`, and **zero** Angular
  projects. Every future Angular lib, every Astro spec and every .NET-era tools lib makes
  this migration bigger.

What this ADR is **not**: it is not a reopening of the NestJS argument. ADR 0007's
2026-10-20 amendment already handled that and declined. The Nest-specific reasons for
rejecting Vitest (`@nx/nest` scaffolding only Jest; Nest DI needing `emitDecoratorMetadata`
that esbuild does not emit) are moot, but their being moot is not on its own a reason to
move — it only removes the blocker. The reason to move is Angular.

## Decision drivers

- **One runner and one mock API for TypeScript.** The same driver ADR 0007 had; the answer
  changes because the frameworks did.
- **Stop fighting scaffold defaults.** Both `@nx/js` and Angular 22 now produce Vitest. A
  convention that every generator contradicts is a convention maintained by vigilance.
- **Decide at the lowest project count.** 13 projects and no Angular app is the cheapest
  this gets, and it is the same "decide while the workspace is nearly empty" argument
  ADRs 0005 and 0017 used.
- **The coverage policy must survive untouched.** ADR 0007's real asset is not Jest — it is
  one number (80%), CI-only collection, and `.github/scripts/coverage-report.cjs` with its
  PR comment and patch coverage. Any migration that disturbs those is not worth doing.
- **No new capability is being bought.** This is consolidation, and the ADR should say so
  rather than claim a speed win it has not measured.

## Considered options

1. **Vitest for every TypeScript project.** **(chosen)**
2. **Stay on Jest, keep the Astro exception** — ADR 0007 as it stands. Rejected: it accepts
   two runners permanently and overrides two framework defaults to do it. Its one real
   advantage is that it costs nothing today.
3. **Split by stack: Vitest for Angular and Astro, Jest for `scope:tools` and shared libs.**
   Rejected for the reason ADR 0007 rejected its own option 3: it is the maintenance surface
   of both runners, plus contributors switching mock API between files in one PR — and here
   it would be the _permanent_ shape rather than a carve-out.
4. **Defer until the first Angular project exists**, then decide against a real suite.
   Rejected: the first Angular project is the walking skeleton, which will scaffold whatever
   the `nx.json` default says, so deferring means migrating _more_ projects later for the
   same reasons. Deferring also leaves the first Angular lib generated against a default
   Angular itself has deprecated.

## Decision outcome

Chosen option: **1 — Vitest for every TypeScript project.** ADR 0007's runner choice is
superseded; its coverage policy is carried forward verbatim against Vitest.

### Locked parameters

- **`unitTestRunner: vitest`** in the `nx.json` generator defaults for `@nx/js:library`,
  `@nx/angular:library` and `@nx/plugin:plugin`. The `@nx/nest:library` entry is deleted
  along with `@nx/nest` itself (ADR 0017). Generating a project with Jest requires reopening
  this ADR.
- **`@nx/vitest` is registered in `nx.json`, and a root shared config is expected.** This
  reverses ADR 0007's two bans (no `@nx/vite` / `@nx/vitest` plugin, no root Vitest config)
  — they existed to keep an accidental toolchain out, and the toolchain is now deliberate.
  The shared config is **`vitest.shared.ts`** at the workspace root, extended by each
  project's `vitest.config.ts`; it is the direct replacement for `jest.preset.js` and holds
  every parameter below.
- **Angular projects test through `@angular/build:unit-test` with `runner: vitest`.** Karma
  is never used.
- **`globals: true`.** The 50 existing specs call bare `describe` / `it` / `expect`, so
  globals keep the migration confined to `jest.*` → `vi.*` rather than adding an import
  block to every file. `vi` is imported explicitly where used.
- **Coverage, identical to ADR 0007's numbers** (and to the Astro amendment's list, which
  this generalizes from one app to the workspace):
  - `coverage.provider: 'v8'` (`@vitest/coverage-v8`).
  - `coverage.enabled: !!process.env.CI` — the same CI-only gate as `collectCoverage`, for
    the same reason: the local inner loop stays fast. `nx test {project} --coverage` opts in.
  - `coverage.thresholds` of **80** for `branches`, `functions`, `lines`, `statements`, as a
    single global block — enforced **per project**, since each project runs its own Vitest
    process under `nx run-many`.
  - `coverage.include: ['src/**/*.ts']`, excluding `*.spec.ts`, `*.{test-d,types}.ts`,
    `*.d.ts` and the barrel `src/index.ts` — the same set as `collectCoverageFrom`.
  - `coverage.reporter: ['text-summary', 'json', 'json-summary', 'lcov']`.
  - `coverage.reportsDirectory` resolving to `coverage/{projectRoot}`.
- **The coverage reporting layer is unchanged.** `.github/scripts/coverage-report.cjs` reads
  `coverage-summary.json` / `coverage-final.json` under `coverage/**`; Vitest's v8 provider
  writes those same files, as ADR 0007's 2026-09-23 amendment already records for the Astro
  app. The PR comment, patch coverage, the affected-vs-workspace labelling (2026-10-16
  amendment) and the no-distributed-run reading (2026-10-20 amendment) all carry over as-is.
- **`passWithNoTests: true`**, same rationale as ADR 0007.
- **`nx test {project}` remains the entry point**, never `vitest` directly.
- **`type:types` libs stay exempt** — no `test` target, nothing to threshold.
- **The Astro carve-out dissolves.** Astro projects are no longer an exception to anything;
  they are ordinary Vitest projects. ADR 0007's 2026-09-23 amendment keeps force only for
  what is Astro-specific and not runner-specific: the **coverage exemption** for a site with
  no `src/**/*.ts` module, the **build-output assertion** suite with `test` `dependsOn`
  `build`, and `.astro` files staying out of `coverage.include`.
- **xUnit with coverlet remains the .NET runner** (ADR 0017), with the same 80% CI-gated
  floor. This ADR changes the TypeScript side only. The workspace still runs one runner per
  language — the count does not change, the TypeScript one does.
- **`node --test` stays for the plain-CommonJS scripts** (`.github/scripts/*.test.cjs`,
  `.claude/hooks/*.test.cjs`). Those run outside Nx in the `actions/github-script` runtime
  and are deliberately not an Nx project; they are not in scope here.

### Migration sequence

Mechanical, and ordered so the workspace is green at each step:

1. Add `vitest`, `@vitest/coverage-v8`, `@nx/vitest` and `@vitest/eslint-plugin`; write
   `vitest.shared.ts` carrying every parameter above.
2. Convert projects one at a time — `vitest.config.ts` in, `jest.config.cts` out — leaving
   the rest on Jest. Both runners coexist during the migration by design.
3. Replace `jest.*` with `vi.*` in the 26 affected files. `jest.fn` / `spyOn` /
   `resetModules` map directly; `jest.mock` becomes `vi.mock`, whose factory is hoisted the
   same way.
4. Rename `libs/shared/jest/testing` — it is named after the runner. Under ADR 0009's
   formula (`shared` dropped from the name once a group disambiguates) the group `vitest`
   gives project name **`vitest-testing`** at `libs/shared/vitest/testing`.
5. Invert the ESLint blocks (ADR 0008): `@vitest/eslint-plugin` becomes the default for
   `**/*.{spec,test}.ts` and the test-artifact suffixes, and `eslint-plugin-jest` is removed
   rather than scoped. The `vitestSpecFiles` path-glob list disappears with it — the reason
   it existed (flat config cannot read project tags) stops mattering once there is no second
   runner to scope.
6. Drop `jest`, `@nx/jest`, `ts-jest`, `jest-environment-node`, `@types/jest` and
   `jest.preset.js`.
7. Supersede ADR 0007, update `docs/agents/conventions.md` §9 and
   `.claude/rules/testing.md` (its coverage-mechanics and run-one-spec-file paragraphs name
   Jest).

## Unverified until the first Angular project exists

Same caveat class as ADR 0017. Nothing here has been exercised against an Angular suite,
because there is none.

1. **That `@nx/angular`'s Vitest path and `@angular/build:unit-test` agree.** Nx's Angular
   plugin and the Angular CLI builder are two routes to Vitest; which one a generated lib
   gets, and whether `nx test` drives the builder or Vitest directly, is unverified here.
2. **TestBed under Vitest.** Angular's testing utilities with zoneless change detection are
   the documented path, but no component spec in this workspace has run under it.
3. **The v8-vs-Jest coverage delta.** v8 instruments differently from Jest's transform, so a
   project sitting near the floor may move a point or two on migration. Expect to look at
   each project's number once rather than assume the 80% gate is a no-op.
4. **Spec type-checking is unchanged, but still absent from `test`.** `ts-jest` was
   transpile-only and Vitest's esbuild transform likewise strips types without checking, so
   `.claude/rules/testing.md`'s rule stands: a spec-only type error is caught by the
   `typecheck` target, not by `test`. Confirm this holds for Angular's builder path.

## Consequences

### Positive

- One runner and one mock API across every TypeScript project, which is what ADR 0007
  wanted and what the Astro amendment gave up.
- No generator default is being overridden any more. A lib generated in a context that
  ignores `nx.json` gets the right runner by accident instead of the wrong one — ADR 0007's
  recorded risk is removed rather than managed.
- The Angular side lands on the framework's own supported path, so Angular upgrades stop
  being a question of whether Jest still works.
- The coverage policy — the part with three amendments and a CI script behind it — is
  untouched: same number, same gate, same reports, same PR comment.
- Done at 13 projects and zero Angular apps rather than after the walking skeleton.

### Negative / risks

- **Churn with no new capability.** 13 projects, 50 specs, 26 files. Vitest is faster, but
  no suite here is slow enough for that to be the reason, and this ADR does not claim it.
- **A third mock API in contributors' heads during the migration**, since step 2 leaves both
  runners in the tree for a while.
- **Coverage numbers may shift** under v8 instrumentation (unverified item 3). The gate is
  per project, so this surfaces as one or two projects needing specs filled in — the same
  thing that happened to `git-utils` when the threshold first landed.
- **`libs/shared/jest/testing` gets renamed**, which changes a project name other projects
  import. Mechanical, but it is a rename rather than an edit.
- **Angular's Vitest support is newer than Jest's.** It is the vendor's default, but it has
  less mileage, and this workspace cannot check that until the walking skeleton exists.
- **ADR 0007 is superseded twice over in six weeks**, having itself reversed an accidental
  Vitest scaffold in #41. The churn is real and worth noting: the workspace is arriving back
  at the runner `@nx/js` picked for it, by a different route.

## More information

- ADR 0007 (`jest-test-runner`) — superseded for the runner choice only. Its coverage
  threshold (2026-09-07), reporting layer (2026-09-08), Astro exception (2026-09-23),
  affected-only coverage (2026-10-16), no-distributed-run (2026-10-20) and xUnit
  (2026-10-20) amendments are the policy this ADR preserves.
- ADR 0017 (`dotnet-backend`) — xUnit for .NET, and the locked-parameters line listing
  TypeScript's runner, which this ADR amends.
- ADR 0012 (`astro-content-sites`) — the stack whose Vitest exception this ADR dissolves.
- ADR 0008 (`eslint-plugin-layer`) — the Jest / Vitest ESLint blocks that invert.
- ADR 0005 (`application-frameworks`) — Angular, the remaining TypeScript stack.
- `jest.preset.js` → `vitest.shared.ts`; `.github/scripts/coverage-report.cjs` (unchanged);
  `docs/agents/conventions.md` §9; `.claude/rules/testing.md`.
- Angular docs: the `@angular/build:unit-test` builder and its `runner` option; the Angular
  22 release notes and the Karma-to-Vitest migration schematic.
- Nx docs: `@nx/vitest`, and `@nx/angular`'s `unitTestRunner` option.
