import { relative, resolve } from 'node:path';
import type { ViteUserConfig } from 'vitest/config';

const workspaceRoot = import.meta.dirname;

/**
 * Builds the Vitest config every project extends (ADR 0018): global test APIs, v8 coverage
 * collected only in CI, an 80% per-project floor, and a `coverage/{projectRoot}` reports
 * directory. `projectDir` is the directory of the calling `vitest.config.mts`.
 *
 * Merge it with the project's own config using `mergeConfig` from `vitest/config`.
 */
export function createBaseVitestConfig(projectDir: string): ViteUserConfig {
  return {
    // Resolve the `@cybertecpty/*` aliases from `tsconfig.base.json` (ADR 0005).
    resolve: { tsconfigPaths: true },
    test: {
      globals: true,
      // `nx run-many` / `nx affected -t test` sweep every project; some legitimately have no
      // unit tests (type:types libs, freshly scaffolded or barrel-only libs). Whether a runtime
      // lib should have tests is a code-review concern, not the runner's exit code. The coverage
      // thresholds below guard against a broken `include` silently passing green.
      passWithNoTests: true,
      watch: false,
      coverage: {
        provider: 'v8',
        // Coverage is collected only in CI (GitHub Actions sets `CI`), so the local `nx test`
        // inner loop stays fast. `nx test {project} --coverage` opts in locally, and the
        // thresholds below are enforced only when coverage is collected.
        enabled: !!process.env['CI'],
        // Every project uses a `src/` layout, resolved against the project root. Instrument all
        // source, not just files a test imports, so an untested module drags the number down
        // instead of hiding.
        include: ['src/**/*.ts'],
        exclude: [
          'src/**/*.spec.ts',
          'src/**/*.{test-d,types}.ts',
          'src/**/*.d.ts',
          'src/index.ts'
        ],
        // `lcov` goes to Codecov, with `projectRoot` so its paths are repo-relative (Codecov cannot
        // tell apart the same `src/` path in two projects); `text-summary` prints the per-project
        // total to the CI log.
        reporter: [
          'text-summary',
          'json',
          'json-summary',
          ['lcov', { projectRoot: workspaceRoot }]
        ],
        reportsDirectory: resolve(workspaceRoot, 'coverage', relative(workspaceRoot, projectDir)),
        // Under `nx run-many` each project runs its own Vitest process, so these thresholds
        // are enforced per project (that project's files only), not against the workspace
        // aggregate. The merged workspace number is reporting-only.
        thresholds: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  };
}
