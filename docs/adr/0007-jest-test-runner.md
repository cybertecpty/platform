# 7. Jest as the workspace test runner

- Status: accepted
- Date: 2026-09-02
- Deciders: djmcgrath
- Implemented by: `unitTestRunner: jest` in the `nx.json` generator defaults for
  `@nx/{js,nest,angular}:library` (landed in #41); `@nx/jest` added on first project
  generation; this ADR + `docs/agents/conventions.md` §9 note

## Context and problem statement

`@nx/js:library` scaffolds **Vitest** by default in Nx 23. Generating the first workspace
lib pulled in `@nx/vite`, `@nx/vitest`, `vite`, `vitest`, and `@vitest/coverage-v8`,
registered the `@nx/vitest` plugin in `nx.json`, and added a root `vitest.config.ts` —
none of it a deliberate choice.

The stacks under test are Angular and NestJS (ADR 0005):

- `@nx/nest`'s `unitTestRunner` option is `jest | none` — it does not scaffold Vitest.
- `@nx/angular` supports both `jest` and `vitest`.
- NestJS DI relies on `emitDecoratorMetadata` + `reflect-metadata`. Vitest's default
  esbuild transform does not emit that metadata, so provider resolution breaks; Nest +
  Vitest needs SWC in the Vitest pipeline (`unplugin-swc` with `emitDecoratorMetadata`).

So the workspace either standardizes on one runner or maintains two — Vitest for
JS/Angular libs, Jest (or hand-wired Vitest) for Nest.

## Decision drivers

- One runner: one config shape, one assertion/mock API (`vi` vs `jest`), one mental
  model, one dependency set.
- Generators should produce a working test setup with no hand-wiring.
- Consistency across a contributor's Nest service test and Angular component test.
- No measured need for Vitest's speed or ESM story yet — there are no projects.

## Considered options

1. **Jest everywhere.**
2. **Vitest everywhere** — generate Nest projects with `--unitTestRunner=none` and
   hand-wire Vitest + `unplugin-swc` each time; maintain it against `@nx/nest` upgrades.
3. **Split** — Vitest for frontend / plain JS libs, Jest for Nest.

## Decision outcome

Chosen option: **1 — Jest everywhere.**

- Option 2: Vitest is faster and has a cleaner ESM story, but `@nx/nest` will not
  scaffold it — every Nest app and lib needs `--unitTestRunner=none` followed by manual
  Vitest + SWC config, re-verified on each `@nx/nest` migration. That is ongoing cost
  with no offsetting benefit at this scale.
- Option 3: two runners is the maintenance surface of both, plus contributors
  context-switching mock APIs between test files in the same PR. Consistency is the
  point of the decision.
- Accepted trade-off: Jest is slower than Vitest on large suites and cold starts, and
  its ESM handling is clunkier (`transformIgnorePatterns` tuning for ESM-only deps).
  `@nx/jest` with an SWC transform (`@swc/jest`) narrows the speed gap. Revisit if suite
  time becomes a real problem, or if Nx adds first-class Vitest support to `@nx/nest`.

### Locked parameters

- **`unitTestRunner: jest`** in the `nx.json` generator defaults for `@nx/js:library`,
  `@nx/nest:library`, and `@nx/angular:library`. App generators set or inherit the same.
  Generating a project with Vitest requires reopening this ADR.
- **No `@nx/vite` / `@nx/vitest` plugin in `nx.json`.** The first lib's accidental Vitest
  toolchain, the `@nx/vitest` plugin registration, and the root `vitest.config.ts` were
  reverted.
- **`nx test {project}` is the entry point** (conventions §9), not `jest` directly.
- **`passWithNoTests: true` in `jest.preset.js`.** `nx run-many` / `nx affected -t test`
  sweep every project and some legitimately have no unit tests (`type:types` libs,
  freshly scaffolded or barrel-only libs); one of those should not fail the whole test
  job. Whether a runtime lib _should_ have tests is a code-review concern
  (review-priorities §3), and a `coverageThreshold` — not this flag — is the guard
  against a silently-broken `testMatch`. See the 2026-09-07 amendment for that
  threshold.
- **E2E is out of scope.** Browser e2e uses Playwright (its own tooling); this ADR
  governs the unit / integration test runner only.

## Consequences

### Positive

- One runner, one config, one mock API across Angular, NestJS, and plain libs.
- `@nx/nest` and `@nx/angular` generators produce a working Jest setup with no manual
  glue.
- Nest DI decorator metadata works through `@nx/jest`'s default transform without an
  extra SWC/esbuild plugin.

### Negative / risks

- Jest is slower than Vitest on large suites and cold starts; `@swc/jest` helps but does
  not close the gap.
- ESM-only dependencies need `transformIgnorePatterns` tuning — a known Jest friction
  point.
- This goes against the `@nx/js` scaffold default (Vitest), so it depends on the
  `nx.json` generator default being read. A lib generated in a context that ignores
  `nx.json` generator defaults gets Vitest, and the accidental toolchain returns.
- If Nx gains first-class Vitest support for `@nx/nest`, the main reason for this choice
  weakens — the ADR should be revisited then, not treated as settled forever.
- No projects yet — unverified against a real suite (same caveat as ADR 0003 / 0004 /
  0006).

## More information

- `nx.json` — the `generators` block (`unitTestRunner: jest` for the three lib
  generators), landed in #41 alongside ADR 0006.
- ADR 0005 (`application-frameworks`) — Angular + NestJS, the stacks under test, and why
  `@nx/nest` + Vitest needs SWC for decorator metadata.
- ADR 0006 (`typed-linting`) — the lint decision committed with the same generator
  defaults.
- `docs/agents/conventions.md` §9 "Testing & verification" — points here.
- `@nx/nest` generator schema — `unitTestRunner` is `jest | none`, no Vitest option.

## Amendment (2026-09-07): coverage threshold

- Status: accepted
- Deciders: djmcgrath
- Implemented by: `coverageThreshold` + `collectCoverage` in `jest.preset.js`; issue #52

The `passWithNoTests: true` note above always deferred to "a `coverageThreshold` — not
this flag" as the real guard against a silently-broken `testMatch`. This amendment adds
that threshold.

### Decision

- **80% global floor** — `coverageThreshold.global` in `jest.preset.js` at
  `branches / functions / lines / statements: 80`. A single `global` block, not
  per-project entries. Under `nx run-many` each project runs its own Jest process, so
  `global` is enforced **per project** (that project's own files), not against the
  workspace aggregate — effectively a per-project gate with one number to maintain.
- **CI-gated collection** — `collectCoverage: !!process.env.CI`. Jest only enforces
  `coverageThreshold` when coverage is collected, so the threshold is a CI gate; the
  local `nx test` inner loop stays fast. `nx test <project> --coverage` opts in locally.
- **`collectCoverageFrom` instruments all `src/**/*.ts`** (minus specs, `*.d.ts`,
  `*.{test-d,types}.ts`, and the barrel `index.ts`), so an untested module counts as a
  gap instead of being invisible. Safe workspace-wide because every project uses a
  `src/` layout.
- **`type:types` libs stay exempt** — `shared-types` / `nx-types` have no `test` target
  (no `jest.config.cts`), so `nx run-many -t test` skips them; there is nothing to
  threshold. `passWithNoTests` covers the "config exists, no specs yet" case.
- **No third-party coverage service.** Codecov / Coveralls were considered for the trend
  dashboard, badge, and PR patch-coverage comment. Rejected for now: they ingest full
  coverage reports (file tree, line-level data) of a private single-repo project, and
  add an external integration + token. Revisit if the repo goes public under BUSL-1.1 —
  the badge and public dashboard become worthwhile and the offsite-exposure concern
  goes away. PR-visible coverage reporting is to be built inside GitHub Actions instead.

### Consequences

- CI test tasks now collect coverage (extra I/O per `test` task; the Jest run itself is
  the same). The per-project `coverage/<projectRoot>/` output is already declared on the
  inferred `test` target, so Nx caches it.
- `git-utils` sat at 70.58% branch coverage (uncovered `simpleGit()` default-argument
  paths); its specs were filled in to 100% as part of #52 before the threshold landed.
  No project carries a per-project override.
- A new runtime project that scaffolds a `test` target must clear 80% or the `test` job
  fails. That is the intended pressure (review-priorities §3).

### Reporting layer (2026-09-08)

The threshold gate above landed first; the reporting layer is the rest of #52. Built
entirely inside GitHub Actions — no third-party service, consistent with the
"no Codecov/Coveralls now" decision:

- **`jest.preset.js`** emits `json` + `json-summary` + `lcov` per project (alongside
  `text-summary`).
- **`.github/scripts/coverage-report.cjs`** — a plain-Node script (not an Nx project;
  it runs in the `actions/github-script` runtime, which wants CommonJS) invoked from
  `ci.yml` after `nx run-many`. It sums the per-project `coverage-summary.json` totals
  into one workspace number (`coverage/coverage-summary.merged.json` + the job summary),
  and on a non-fork pull request computes **patch coverage** — the covered fraction of
  the `src` lines the PR adds, from the merged `coverage-final.json` maps intersected
  with `git diff` — then upserts a single PR comment (matched by an HTML marker). Its
  pure helpers are unit-tested with `node --test` (`coverage-report.test.cjs`), run as
  its own CI step.
- **`ci.yml`** uploads the per-project `coverage/` tree as a build artifact and adds
  `pull-requests: write` for the comment.
- Nx hydrates each project's `coverage/{projectRoot}` output onto the main runner after
  the distributed run (the inferred `test` target already declares it as an output), so
  the script sees every report without a separate collection step.

## Amendment (2026-09-23): Vitest for Astro projects

- Status: accepted
- Deciders: djmcgrath
- Implemented by (planned): per-project `vitest.config.ts` in `apps/cybertec-io`; an
  ESLint override scoping `eslint-plugin-jest` away from Vitest projects

ADR 0012 adds Astro for content sites. Jest can't test Astro components: there is no
maintained Jest transform for `.astro` files, and Astro's component-testing API (the
Container API, `astro/container`) runs inside Vite through `getViteConfig` from
`astro/config`, which means Vitest. This amendment makes a **scoped exception**.

### Decision

- **Vitest for Astro projects only.** Every other project stays on Jest. The rule is
  "Jest everywhere, except Vite-native frameworks (Astro)". Using Vitest for an Angular,
  Nest or plain TS project still requires reopening this ADR.
- **Why the original reasoning doesn't apply:** Vitest was rejected because `@nx/nest`
  can't scaffold it and Nest DI needs SWC glue for decorator metadata, and to avoid
  maintaining two runners. Astro has no decorators and no Nx generator, and Jest can't test
  it at all, so the second runner can't be avoided.
- **Still no `@nx/vite` / `@nx/vitest` plugin in `nx.json`,** and no root
  `vitest.config.ts`. The Astro app has its own `vitest.config.ts` and an explicit
  `test` target in its `project.json` (`nx:run-commands` running `vitest run`), which
  declares the `coverage/{projectRoot}` output when coverage applies. The
  `unitTestRunner: jest` generator defaults are unchanged.
- **Coverage applies to TypeScript logic, not markup.** An Astro project that has
  TypeScript modules (`src/**/*.ts`: utilities, data transforms, island scripts) gets the
  same gate as the Jest preset, configured as in the list below. An Astro project with
  none is **exempt from the threshold**, the same way `type:types` libs are. Its `.astro`
  files are markup and copy, and there's no logic for a line-coverage number to measure.
  An exempt project still has a `test` target. Its suite is **build-output
  assertions**: Vitest specs under `tests/` that read the built `dist/` HTML and check
  section anchors, SEO and social meta, structured data, and that the static assets are
  emitted. The `test` target `dependsOn` `build`. The exemption ends when the first
  `src/**/*.ts` module lands, and coverage is then set up as below.
- **Coverage config, when it applies,** matches the Jest preset:
  - `coverage.provider: 'v8'` (`@vitest/coverage-v8`).
  - `coverage.enabled: !!process.env.CI`, the same CI-gated collection as
    `collectCoverage`.
  - `coverage.thresholds` of 80 for `branches`, `functions`, `lines` and `statements`.
  - `coverage.include: ['src/**/*.ts']`, excluding specs and `*.d.ts`.
  - `coverage.reporter: ['text-summary', 'json', 'json-summary', 'lcov']`.
  - `coverage.reportsDirectory` set to `<workspace>/coverage/apps/<name>`.

  Vitest writes the same Istanbul `coverage-summary.json` and `coverage-final.json` files
  as Jest, so `.github/scripts/coverage-report.cjs`, which finds them under `coverage/**`,
  merges Astro coverage into the workspace number and PR patch coverage without changes.

- **`passWithNoTests: true`** in the app's Vitest config, the same as the Jest preset.
- **Lint:** `eslint-plugin-jest` is scoped away from Vitest projects, and
  `@vitest/eslint-plugin` (recommended config) applies to their spec files instead. The
  ADR 0008 plugin layer gets the matching override.
- **What to test:** content sites carry little logic. Unit-test TypeScript modules.
  Check the rendered output with build-output assertions. Interactive behaviour (such as
  the mobile menu) belongs in Playwright e2e (`<app>-e2e`, ADR 0010), which is still out
  of scope for this ADR.

### Consequences

- Two runners and two mock APIs (`jest` and `vi`) in the tree. This is the cost the
  original decision avoided, and it is accepted here because only Astro projects use
  Vitest.
- Vitest and `@vitest/eslint-plugin` come back as root dev dependencies, plus
  `@vitest/coverage-v8` once coverage applies. They were removed in #41 when they arrived
  by accident. This time they are deliberate.
- A coverage-exempt Astro site doesn't count toward the workspace coverage number or
  PR patch coverage. That's intentional: its `.astro` changes are markup, and the
  build-output tests guard them.
- The exemption depends on reviewers noticing when the first `src/**/*.ts` module lands
  and adding the coverage config at that point (review-priorities §3).
- `.astro` files are left out of `coverage.include`. v8 coverage of compiled Astro
  components doesn't map back to source reliably enough to gate on.
- The Container API was still `experimental_`-prefixed when last checked. Confirm its
  status before using it for component tests.
