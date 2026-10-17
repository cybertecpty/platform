import type { ExecutorContext, TargetConfiguration } from '@nx/devkit';

export interface CreateExecutorContextFixtureOptions {
  /** Project the executor runs for. */
  projectName: string;

  /** Project root, relative to the workspace root. */
  projectRoot: string;

  /** The project's targets, mirrored into the project graph and configurations. */
  targets?: Record<string, TargetConfiguration>;
}

/**
 * Build an `ExecutorContext` fixture for executor specs: one `app` project in a
 * `/workspace` root, described identically in the project graph and the
 * projects configurations. `overrides` replace top-level fields, e.g.
 * `{ projectName: undefined }` to model running outside a project target.
 * Rename the project through `options`, not `overrides`, so the graph and
 * configurations stay keyed by the same name.
 */
export const createExecutorContextFixture = (
  { projectName, projectRoot, targets = {} }: CreateExecutorContextFixtureOptions,
  overrides: Partial<ExecutorContext> = {}
): ExecutorContext => ({
  root: '/workspace',
  cwd: '/workspace',
  isVerbose: false,
  projectName,
  projectGraph: {
    nodes: {
      [projectName]: { name: projectName, type: 'app', data: { root: projectRoot, targets } }
    },
    dependencies: {}
  },
  projectsConfigurations: {
    version: 2,
    projects: { [projectName]: { root: projectRoot, targets } }
  },
  nxJsonConfiguration: {},
  ...overrides
});
