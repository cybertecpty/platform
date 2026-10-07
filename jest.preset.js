const nxPreset = require('@nx/jest/preset').default;

module.exports = {
  ...nxPreset,
  // `nx run-many` / `nx affected -t test` sweep every project; some legitimately
  // have no unit tests (type:types libs, freshly scaffolded or barrel-only libs).
  // Whether a runtime lib *should* have tests is a code-review concern, not the
  // runner's exit code. `coverageThreshold` below is the guard against a broken
  // testMatch silently passing green.
  passWithNoTests: true,

  // Coverage is collected only in CI (GitHub Actions sets `CI`), so the local
  // `nx test` inner loop stays fast. Run `nx test <project> --coverage` to opt
  // in locally. `coverageThreshold` is enforced only when coverage is collected,
  // so it too is effectively a CI gate — see ADR 0007 and issue #52.
  collectCoverage: !!process.env.CI,

  // `<rootDir>` resolves to each consuming project's root (the dir of its
  // `jest.config.cts`). Every project uses a `src/` layout, so these globs are
  // safe workspace-wide. Instrument all source — not just files a test imports —
  // so an untested module drags the number down instead of hiding.
  collectCoverageFrom: [
    '<rootDir>/src/**/*.ts',
    '!<rootDir>/src/**/*.spec.ts',
    '!<rootDir>/src/**/*.{test-d,types}.ts',
    '!<rootDir>/src/**/*.d.ts',
    '!<rootDir>/src/index.ts'
  ],

  // `json` feeds the workspace-level `istanbul-merge` rollup in CI; `json-summary`
  // and `lcov` feed the PR coverage comment; `text-summary` prints the per-project
  // total to the CI log.
  coverageReporters: ['text-summary', 'json', 'json-summary', 'lcov'],

  // Under `nx run-many` each project runs its own Jest process, so this `global`
  // block is enforced per project (that project's files only), not against the
  // workspace aggregate. The merged workspace number is reporting-only.
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
