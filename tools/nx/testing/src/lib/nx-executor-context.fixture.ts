import type { ExecutorContext } from '@nx/devkit';
import {
  createProjectGraphFixture,
  type CreateProjectGraphFixtureOptions
} from './nx-project-graph.fixture';

/** The project the executor runs for, mirrored into the graph and the configurations. */
export type CreateExecutorContextFixtureOptions = CreateProjectGraphFixtureOptions;

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
  projectGraph: createProjectGraphFixture({ projectName, projectRoot, targets }),
  projectsConfigurations: {
    version: 2,
    projects: { [projectName]: { root: projectRoot, targets } }
  },
  nxJsonConfiguration: {},
  ...overrides
});
