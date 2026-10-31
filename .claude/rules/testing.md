---
paths:
  - '**/*.spec.ts'
  - '**/*.test.ts'
  - '**/*.{mock,mocks,stub,stubs,fake,fakes,fixture,fixtures}.ts'
  - '{libs,tools}/**/testing/**'
  - '**/jest.config.*'
  - 'jest.preset.js'
---

# Writing tests

Moved here from `docs/agents/conventions.md` §9, which keeps the runner and verification
defaults. Loads when working on specs, test artifacts, `type:testing` libs, or Jest config.

- Unit tests are `*.spec.ts`, beside the implementation.
- **Name test artifacts `<name>.<kind>.ts`**, by what the file exports (Meszaros's
  vocabulary), with the plural kind for a file holding several:

  | Kind                     | Exports                                                                      |
  | ------------------------ | ---------------------------------------------------------------------------- |
  | `.mock` / `.mocks`       | a double the test checks calls on (`jest.fn()`, `jest.mock` factories)       |
  | `.stub` / `.stubs`       | a double returning canned answers, checked only through the output           |
  | `.fake` / `.fakes`       | a working, simplified implementation (an in-memory store, a fake executor)   |
  | `.fixture` / `.fixtures` | test data: constants, presets, or a builder function with per-test overrides |

  Inside a group's lib, keep the group prefix the source files use
  (`nx-executor-context.fixture.ts` in `tools/nx/testing`). Spies (`jest.spyOn`) and dummies
  stay inline, with no suffix. These suffixes are reserved for test code; don't use them for
  production files. There is deliberately no `.builder` suffix: a test-data builder is a
  `.fixture`, because "builder" collides with production builders and Angular CLI builders.
  **Always put test artifacts in a `type:testing` lib (ADR 0004), never beside the spec**,
  even when one spec uses them. If the project has no testing lib yet, generate one
  (`nx g @cybertecpty/js-plugin:ts-lib testing ...`); a testing lib must not import the
  project whose specs use it, or the project graph gets a cycle. Spies (`jest.spyOn`) and
  dummies stay inline.

- **Name the function that creates a test artifact after its kind**, so a call site shows it
  isn't the real thing. Ask whether it pretends to be the thing or is data of that type:
  - A double (`mock`, `stub`, `fake`) pretends, and the kind reads as an adjective, so it goes
    **first**: `createFakeTree`, `createMockLogger`, `createStubHttpClient`.
  - A fixture is a real instance used as test data, and the kind reads only as a noun, so it
    goes **last**: `createExecutorContextFixture`, `createProjectGraphFixture`.

  The same applies to a spec's local wrappers (`createContextFixture`) and to exported constants
  (`EXECUTOR_CONTEXT_FIXTURE`, `mockLogger`). File suffixes stay fixed at the end whatever the
  kind, because the lint glob matches them.

- Name the top-level `describe` after the exported unit; write `it(...)` names as
  behavior statements.
- `eslint-plugin-jest` `flat/recommended` lints spec files and the test artifacts above
  (`*.{spec,test}.ts` and every suffix in the table) — a left-in `fit` / `fdescribe` /
  `.only`, an `expect()` with no matcher, or a duplicated `it()` title fails `nx lint` (ADR
  0008). The same block relaxes `@nx/enforce-module-boundaries` and a few TS rules for test code.
- Prefer direct assertions over snapshots.
- **Don't test a function by mocking the collaborator that holds its behavior.** A spec that
  hands canned output to a mocked `simple-git` or `raw` proves which calls the function makes,
  not that git answers the way the function assumes. Run it against the real thing: for git, a
  throwaway repository from `@cybertecpty/git-testing` (`createGitRepoFixture`,
  `cloneGitRepoFixture`). Keep one `.spec.ts` per source file, not a mocked spec plus an
  `.integration.spec.ts`, and no file-wide `simple-git` mock in a spec that uses the fixture.
  A case real git cannot produce (unparsable output) may stay as one fake-client case.
- Run one spec file with a Jest path pattern after `--`:
  `pnpm exec nx test {project} -- {file-pattern}`. Nx forwards unknown flags to Jest, which has no
  `--testFile`, so that flag fails the run.
- For Nx generators / workspace utilities, use `createTreeWithEmptyWorkspace()` and
  assert against the in-memory `Tree`, generated files, and project config.
- **Coverage mechanics.** `jest.preset.js` sets `coverageThreshold.global` to 80 and
  `collectCoverage: !!process.env.CI`, so local `nx test` stays fast and the threshold gates
  CI. Each project runs its own Jest process, so it is a per-project gate. `type:types` libs have no `test` target and
  are exempt. CI also merges the per-project reports into one number (workspace on a push, affected
  projects on a PR), uploads
  `coverage/` as an artifact, and posts a per-PR coverage comment (per-project table + patch
  coverage for changed lines) — all inside GitHub Actions, no third-party service
  (`.github/scripts/coverage-report.cjs`, unit-tested with `node --test`). It reads .NET
  projects' coverlet lcov (`coverage.info`) beside the Istanbul files; the dotnet plugin adds
  `{workspaceRoot}/coverage/{projectRoot}` to the `test` outputs of every .NET project tagged
  `type:testing`, so a tests project declares nothing itself (ADR 0017); the cached `check-coverage-output` target fails CI, naming the project, if the resolved output is ever missing. Astro sites run
  Vitest and mirror these settings in their own `vitest.config.ts` (ADR 0007 2026-09-23
  amendment).
- **Spec files are type-checked by the `typecheck` target, not `test`.** `ts-jest` is
  transpile-only and `build` excludes `*.spec.ts`, so a spec-only type error (a bad
  cast, a `never`-typed arg) slips through both. `.claude/rules/project-config.md` covers
  the `typecheck` stub every project needs.
