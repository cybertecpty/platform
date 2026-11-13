import {
  addProjectConfiguration,
  readProjectConfiguration,
  type ProjectConfiguration,
  type Tree
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { setupWebappGenerator } from './generator';
import type { SetupWebappGeneratorOptions } from './schema';

const PACKAGE_EXECUTOR = '@cybertecpty/node-plugin:file-archive';
const DEPLOY_EXECUTOR = '@cybertecpty/azure-plugin:webapp-deploy';

describe('setupWebappGenerator', () => {
  let tree: Tree;
  const options: SetupWebappGeneratorOptions = {
    project: 'web',
    resourceGroup: 'my-group',
    subscription: 'my-subscription'
  };

  const addApp = (targets?: ProjectConfiguration['targets']): void => {
    addProjectConfiguration(tree, 'web', { root: 'apps/web', tags: ['type:app'], targets });
  };
  const readTargets = (): NonNullable<ProjectConfiguration['targets']> =>
    readProjectConfiguration(tree, 'web').targets ?? {};

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('rejects a project that is not an app', async () => {
    addProjectConfiguration(tree, 'web', { root: 'libs/web', tags: ['type:utils'] });

    await expect(setupWebappGenerator(tree, options)).rejects.toThrow(
      'Project web is not an application.'
    );
  });

  it('adds a package target that archives the build output after build', async () => {
    addApp();

    await setupWebappGenerator(tree, options);

    expect(readTargets()['package']).toEqual({
      executor: PACKAGE_EXECUTOR,
      dependsOn: ['build'],
      outputs: ['{workspaceRoot}/deploy/web.zip'],
      options: { destination: 'deploy', filename: 'web.zip', format: 'zip' }
    });
  });

  it('adds a deploy target that uploads the archive after package', async () => {
    addApp();

    await setupWebappGenerator(tree, options);

    expect(readTargets()['deploy']).toEqual({
      executor: DEPLOY_EXECUTOR,
      dependsOn: ['package'],
      options: {
        name: 'web',
        resourceGroup: 'my-group',
        srcPath: 'deploy/web.zip',
        subscription: 'my-subscription'
      }
    });
  });

  it('names the Web App with the name option instead of the project name', async () => {
    addApp();

    await setupWebappGenerator(tree, { ...options, name: 'my-web-app' });

    expect(readTargets()['deploy']?.options).toMatchObject({ name: 'my-web-app' });
  });

  it('uses srcPath for the archive, its outputs and the deploy', async () => {
    addApp();

    await setupWebappGenerator(tree, { ...options, srcPath: 'dist/out/site.zip' });

    expect(readTargets()['package']).toMatchObject({
      outputs: ['{workspaceRoot}/dist/out/site.zip'],
      options: { destination: 'dist/out', filename: 'site.zip' }
    });
    expect(readTargets()['deploy']?.options).toMatchObject({ srcPath: 'dist/out/site.zip' });
  });

  it('normalizes a srcPath with backslashes', async () => {
    addApp();

    await setupWebappGenerator(tree, { ...options, srcPath: 'dist\\out\\site.zip' });

    expect(readTargets()['package']).toMatchObject({
      outputs: ['{workspaceRoot}/dist/out/site.zip'],
      options: { destination: 'dist/out', filename: 'site.zip' }
    });
    expect(readTargets()['deploy']?.options).toMatchObject({ srcPath: 'dist/out/site.zip' });
  });

  it('keeps the targets the project already has', async () => {
    addApp({ build: { executor: 'nx:noop' } });

    await setupWebappGenerator(tree, options);

    expect(Object.keys(readTargets()).sort()).toEqual(['build', 'deploy', 'package']);
  });

  it('is idempotent', async () => {
    addApp();

    await setupWebappGenerator(tree, options);
    const first = readProjectConfiguration(tree, 'web');
    await setupWebappGenerator(tree, options);

    expect(readProjectConfiguration(tree, 'web')).toEqual(first);
  });

  it.each(['package', 'deploy'])(
    'rejects a %s target that runs another executor',
    async targetName => {
      addApp({ [targetName]: { executor: 'nx:noop' } });

      await expect(setupWebappGenerator(tree, options)).rejects.toThrow(
        `Project web already has a "${targetName}" target that runs nx:noop.`
      );
    }
  );

  it('changes nothing when a target is rejected', async () => {
    addApp({ deploy: { executor: 'nx:noop' } });
    const before = readProjectConfiguration(tree, 'web');

    await expect(setupWebappGenerator(tree, options)).rejects.toThrow();

    expect(readProjectConfiguration(tree, 'web')).toEqual(before);
  });
});
