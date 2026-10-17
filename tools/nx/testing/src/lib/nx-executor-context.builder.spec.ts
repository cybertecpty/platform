import type { TargetConfiguration } from '@nx/devkit';
import { createExecutorContext } from './nx-executor-context.builder';

describe('createExecutorContext', () => {
  const build: TargetConfiguration = { outputs: ['{workspaceRoot}/dist/{projectRoot}'] };

  it('runs the named project from the workspace root', () => {
    const context = createExecutorContext({ projectName: 'my-app', projectRoot: 'apps/my-app' });

    expect(context).toMatchObject({
      root: '/workspace',
      cwd: '/workspace',
      isVerbose: false,
      projectName: 'my-app',
      nxJsonConfiguration: {}
    });
  });

  it('describes the project the same way in the graph and the configurations', () => {
    const targets = { build };

    const context = createExecutorContext({
      projectName: 'my-app',
      projectRoot: 'apps/my-app',
      targets
    });

    expect(context.projectGraph).toEqual({
      nodes: {
        'my-app': { name: 'my-app', type: 'app', data: { root: 'apps/my-app', targets } }
      },
      dependencies: {}
    });
    expect(context.projectsConfigurations).toEqual({
      version: 2,
      projects: { 'my-app': { root: 'apps/my-app', targets } }
    });
  });

  it('gives the project no targets by default', () => {
    const context = createExecutorContext({ projectName: 'my-lib', projectRoot: 'libs/my-lib' });

    expect(context.projectsConfigurations.projects['my-lib']?.targets).toEqual({});
    expect(context.projectGraph.nodes['my-lib']?.data.targets).toEqual({});
  });

  it('applies overrides on top of the defaults', () => {
    const context = createExecutorContext(
      { projectName: 'my-app', projectRoot: 'apps/my-app' },
      { root: '/other', isVerbose: true, targetName: 'deploy' }
    );

    expect(context).toMatchObject({
      root: '/other',
      cwd: '/workspace',
      isVerbose: true,
      targetName: 'deploy'
    });
  });

  it('can model running outside a project target', () => {
    const context = createExecutorContext(
      { projectName: 'my-app', projectRoot: 'apps/my-app' },
      { projectName: undefined }
    );

    expect(context.projectName).toBeUndefined();
  });
});
