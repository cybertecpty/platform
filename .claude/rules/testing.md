---
paths:
  - '**/*.spec.ts'
  - '**/*.test.ts'
  - '**/*.{mock,mocks}.ts'
  - '**/jest.config.*'
  - 'jest.preset.js'
---

# Writing tests

Moved here from `docs/agents/conventions.md` §9, which keeps the runner and verification
defaults. Loads when working on specs or Jest config.

- Unit tests are `*.spec.ts`, beside the implementation.
- Name the top-level `describe` after the exported unit; write `it(...)` names as
  behavior statements.
- `eslint-plugin-jest` `flat/recommended` lints spec / mock files (`*.{spec,test}.ts`,
  `*.{mock,mocks}.ts`) — a left-in `fit` / `fdescribe` / `.only`, an `expect()` with no
  matcher, or a duplicated `it()` title fails `nx lint` (ADR 0008). The same block
  relaxes `@nx/enforce-module-boundaries` and a few TS rules for test code.
- Prefer direct assertions over snapshots.
- For Nx generators / workspace utilities, use `createTreeWithEmptyWorkspace()` and
  assert against the in-memory `Tree`, generated files, and project config.
- **Coverage mechanics.** `jest.preset.js` sets `coverageThreshold.global` to 80 and
  `collectCoverage: !!process.env.CI`, so local `nx test` stays fast and the threshold gates
  CI. Each project runs its own Jest process, so it is a per-project gate. `type:types` libs have no `test` target and
  are exempt. CI also merges the per-project reports into one number (workspace on a push, affected
  projects on a PR), uploads
  `coverage/` as an artifact, and posts a per-PR coverage comment (per-project table + patch
  coverage for changed lines) — all inside GitHub Actions, no third-party service
  (`.github/scripts/coverage-report.cjs`, unit-tested with `node --test`). Astro sites run
  Vitest and mirror these settings in their own `vitest.config.ts` (ADR 0007 2026-09-23
  amendment).
- **Spec files are type-checked by the `typecheck` target, not `test`.** `ts-jest` is
  transpile-only and `build` excludes `*.spec.ts`, so a spec-only type error (a bad
  cast, a `never`-typed arg) slips through both. `.claude/rules/project-config.md` covers
  the `typecheck` stub every project needs.
