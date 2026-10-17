import type { TargetConfiguration } from '@nx/devkit';
import { createProjectGraphFixture } from './nx-project-graph.fixture';

describe('createProjectGraphFixture', () => {
  const build: TargetConfiguration = { outputs: ['{workspaceRoot}/dist/{projectRoot}'] };

  it('describes one app project with the given targets and no dependencies', () => {
    const graph = createProjectGraphFixture({
      projectName: 'my-app',
      projectRoot: 'apps/my-app',
      targets: { build }
    });

    expect(graph).toEqual({
      nodes: {
        'my-app': {
          name: 'my-app',
          type: 'app',
          data: { root: 'apps/my-app', targets: { build } }
        }
      },
      dependencies: {}
    });
  });

  it('gives the project no targets by default', () => {
    const graph = createProjectGraphFixture({ projectName: 'my-app', projectRoot: 'apps/my-app' });

    expect(graph.nodes['my-app']?.data.targets).toEqual({});
  });
});
