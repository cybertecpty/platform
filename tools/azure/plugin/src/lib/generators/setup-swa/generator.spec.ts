import { addProjectConfiguration, readProjectConfiguration, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { setupSwaGenerator } from './generator';

describe('setupSwaGenerator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('rejects a project that is not an app', async () => {
    addProjectConfiguration(tree, 'lib', { root: 'libs/lib', tags: ['type:utils'] });

    await expect(setupSwaGenerator(tree, { project: 'lib' })).rejects.toThrow(
      'Project lib is not an application.'
    );
  });

  it('adds a swa-deploy target that depends on build', async () => {
    addProjectConfiguration(tree, 'web', { root: 'apps/web', tags: ['type:app'] });

    await setupSwaGenerator(tree, { project: 'web' });

    expect(readProjectConfiguration(tree, 'web').targets?.['deploy']).toEqual({
      executor: '@cybertecpty/azure-plugin:swa-deploy',
      dependsOn: ['build']
    });
  });

  it('passes outputPath to the deploy target when given', async () => {
    addProjectConfiguration(tree, 'web', { root: 'apps/web', tags: ['type:app'] });

    await setupSwaGenerator(tree, { project: 'web', outputPath: 'dist/web' });

    expect(readProjectConfiguration(tree, 'web').targets?.['deploy']?.options).toEqual({
      outputPath: 'dist/web'
    });
  });

  it('replaces an existing deploy target that runs swa-deploy', async () => {
    addProjectConfiguration(tree, 'web', {
      root: 'apps/web',
      tags: ['type:app'],
      targets: {
        deploy: {
          executor: '@cybertecpty/azure-plugin:swa-deploy',
          options: { outputPath: 'dist/old' }
        }
      }
    });

    await setupSwaGenerator(tree, { project: 'web' });

    expect(readProjectConfiguration(tree, 'web').targets?.['deploy']).toEqual({
      executor: '@cybertecpty/azure-plugin:swa-deploy',
      dependsOn: ['build']
    });
  });

  it('rejects an existing deploy target that runs another executor', async () => {
    addProjectConfiguration(tree, 'web', {
      root: 'apps/web',
      tags: ['type:app'],
      targets: { deploy: { executor: 'nx:noop' } }
    });

    await expect(setupSwaGenerator(tree, { project: 'web' })).rejects.toThrow(
      'Project web already has a "deploy" target that runs nx:noop.'
    );
  });

  it('is idempotent', async () => {
    addProjectConfiguration(tree, 'web', { root: 'apps/web', tags: ['type:app'] });

    await setupSwaGenerator(tree, { project: 'web', outputPath: 'dist/web' });
    const first = readProjectConfiguration(tree, 'web');
    await setupSwaGenerator(tree, { project: 'web', outputPath: 'dist/web' });

    expect(readProjectConfiguration(tree, 'web')).toEqual(first);
  });
});
