import type { ProjectGraph, TargetConfiguration } from '@nx/devkit';

export interface CreateProjectGraphFixtureOptions {
  /** The one project, in the graph and anything built around it. */
  projectName: string;

  /** Project root, relative to the workspace root. */
  projectRoot: string;

  /** The project's targets. */
  targets?: Record<string, TargetConfiguration>;
}

/**
 * Build a `ProjectGraph` fixture for specs: one `app` project with the given
 * targets and no dependencies.
 */
export const createProjectGraphFixture = ({
  projectName,
  projectRoot,
  targets = {}
}: CreateProjectGraphFixtureOptions): ProjectGraph => ({
  nodes: {
    [projectName]: { name: projectName, type: 'app', data: { root: projectRoot, targets } }
  },
  dependencies: {}
});
