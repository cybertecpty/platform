---
paths:
  - '**/*.spec.ts'
  - '**/*.test.ts'
  - '{libs,tools}/**/testing/**'
  - '**/vitest.config.*'
  - 'vitest.base.mts'
---

# Writing tests

Moved here from `docs/agents/conventions.md` §9, which keeps the runner and verification
defaults. Loads when working on specs, test artifacts, `type:testing` libs, or Vitest config.

- Unit tests are `*.spec.ts`, beside the implementation.
- **Name a test artifact's file after what it exports, with the kind (Meszaros's vocabulary) in
  the name**, like any source file (`file-naming.md`): `executor-context-fixture.ts`,
  `library-generator-fake.ts`. The kind is a word in the name, not a suffix:

  | Kind      | Exports                                                                      |
  | --------- | ---------------------------------------------------------------------------- |
  | `mock`    | a double the test checks calls on (`vi.fn()`, `vi.mock` factories)           |
  | `stub`    | a double returning canned answers, checked only through the output           |
  | `fake`    | a working, simplified implementation (an in-memory store, a fake executor)   |
  | `fixture` | test data: constants, presets, or a builder function with per-test overrides |

  Spies (`vi.spyOn`) and dummies stay inline. There is deliberately no `builder` kind: a
  test-data builder is a `fixture`, because "builder" collides with production builders and
  Angular CLI builders.
  **Always put test artifacts in a `type:testing` lib (ADR 0004), never beside the spec**,
  even when one spec uses them: the lint config finds them by that folder, not by their name
  (see the lint bullet below). If the project has no testing lib yet, generate one
  (`nx g @cybertecpty/js-plugin:ts-lib testing ...`); a testing lib must not import the
  project whose specs use it, or the project graph gets a cycle.

- **Name the function that creates a test artifact after its kind**, so a call site shows it
  isn't the real thing. Ask whether it pretends to be the thing or is data of that type:
  - A double (`mock`, `stub`, `fake`) pretends, and the kind reads as an adjective, so it goes
    **first**: `createFakeTree`, `createMockLogger`, `createStubHttpClient`.
  - A fixture is a real instance used as test data, and the kind reads only as a noun, so it
    goes **last**: `createExecutorContextFixture`, `createProjectGraphFixture`.

  The same applies to a spec's local wrappers (`createContextFixture`) and to exported constants
  (`EXECUTOR_CONTEXT_FIXTURE`, `mockLogger`).

- Name the top-level `describe` after the exported unit; write `it(...)` names as
  behavior statements.
- `@vitest/eslint-plugin` `recommended` lints spec files (`*.{spec,test}.ts`, except
  `apps/*/e2e`, which gets the Playwright rules) and every file under a `testing` lib's `src`
  (`{libs,tools}/**/testing/src/**/*.ts`, except the shared Playwright lib, whose gate code gets the
  Playwright rules) — a left-in `.only`, an `expect()` with no matcher, or a duplicated `it()`
  title fails `nx lint` (ADR 0008). A test artifact outside a `testing` lib's `src` is not linted
  as test code, so keep production code out of `testing` libs and artifacts in them. The same
  rules relax `@nx/enforce-module-boundaries` and a few TS rules for test code.
- Prefer direct assertions over snapshots.
- **Don't test a function by mocking the collaborator that holds its behavior.** A spec that
  hands canned output to a mocked `simple-git` or `raw` proves which calls the function makes,
  not that git answers the way the function assumes. Run it against the real thing: for git, a
  throwaway repository from `@cybertecpty/git-testing` (`createGitRepoFixture`,
  `cloneGitRepoFixture`). Keep one `.spec.ts` per source file, not a mocked spec plus an
  `.integration.spec.ts`, and no file-wide `simple-git` mock in a spec that uses the fixture.
  A case real git cannot produce (unparsable output) may stay as one fake-client case.
- Run one spec file with a path filter after `--`:
  `pnpm exec nx test {project} -- {file-filter}`. Nx forwards the filter to Vitest, which runs
  the spec files whose path contains it (`git-repo-fixture` and `src/lib/git-repo-fixture.spec.ts`
  both work). A filter that matches nothing still exits 0 (`passWithNoTests`), so check the
  output names the spec you meant. Nx forwards unknown flags too, so `--testFile` fails the run.
- **Vitest mock pitfalls.** `vi.mock` has no `{ virtual: true }`, so mock
  only packages that are installed (an ESM-only one such as `lighthouse` mocks plainly). A
  `mockImplementation` that the code under test calls with `new` must be a `function () {}`: an
  arrow function throws "is not a constructor". `vi.mock` and `vi.doMock` do not intercept a
  CommonJS `require` in the source: spy on `Module._load` for that one
  path and defer to the real loader otherwise. Assert only the requested path, since its
  `parent` and `isMain` arguments differ between Windows and Linux.
- **A mocked package hides a bad import of it.** A spec that `vi.mock`s a package never loads the
  real one, so a named import that only works through a bundler's interop passes every test and
  then fails in native Node ESM (`import { debug } from 'debug'`: `debug` is CommonJS). For a
  CommonJS package use the default import, and check a new import once against the real package:
  `node --input-type=module -e "import x from 'pkg'"` from the repo root.
- For Nx generators / workspace utilities, use `createTreeWithEmptyWorkspace()` and
  assert against the in-memory `Tree`, generated files, and project config.
- **Coverage mechanics.** The root `vitest.base.mts` sets the v8 coverage `thresholds` to 80 and
  `coverage.enabled: !!process.env.CI`, so local `nx test` stays fast and the threshold gates
  CI. Each project runs its own Vitest process, so it is a per-project gate. `type:types` libs
  have no `test` target and are exempt. CI uploads `coverage/` as an artifact and sends the
  Vitest `lcov.info` and coverlet `coverage.info` reports to Codecov (`codecov.yml`), which posts
  the per-PR comment (totals + patch coverage for changed lines) and the status
  checks. Those start informational, so the runners above stay the only gate. The upload needs
  the `CODECOV_TOKEN` secret, so fork PRs skip it. Vitest's lcov reporter sets `projectRoot` to
  the workspace so the paths are repo-relative. The dotnet
  plugin adds `{workspaceRoot}/coverage/{projectRoot}` to the `test` outputs of every .NET
  project tagged `type:testing`, so a tests project declares nothing itself (ADR
  0017); the cached `check-coverage-output` target fails CI, naming the project, if the resolved
  output is ever missing. Astro sites mirror these settings in their own `vitest.config.ts`
  (ADR 0012).
- A spec that `require`s a `.ts` file loads it through Node, which v8 coverage cannot see, so the
  project's number drops. Load it with `await import()` so Vite transforms it.
- **Spec files are type-checked by the `typecheck` target, not `test`.** Vitest transpiles
  without type-checking and `build` excludes `*.spec.ts`, so a spec-only type error (a bad
  cast, a `never`-typed arg) slips through both. `.claude/rules/project-config.md` covers
  the `typecheck` stub every project needs.
