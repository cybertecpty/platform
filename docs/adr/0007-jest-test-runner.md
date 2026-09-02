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
  against a silently-broken `testMatch`.
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
