import { readJson, readProjectConfiguration } from '@nx/devkit';
import { createFakeLibraryGenerator } from './nx-library-generator.fake';
import { createWorkspaceTreeFixture } from './nx-workspace-tree.fixture';

describe('createFakeLibraryGenerator', () => {
  const options = { name: 'billing-models', directory: 'libs/billing/models' };

  it('adds the project configuration', async () => {
    const tree = createWorkspaceTreeFixture();

    await createFakeLibraryGenerator()(tree, options);

    expect(readProjectConfiguration(tree, 'billing-models')).toMatchObject({
      root: 'libs/billing/models',
      projectType: 'library',
      targets: { build: {} }
    });
  });

  it("appends the project's path to `tsconfig.base.json`, unsorted", async () => {
    const tree = createWorkspaceTreeFixture({
      tsConfigPaths: { '@cybertecpty/zzz-existing': ['./tools/zzz/existing/src/index.ts'] }
    });

    await createFakeLibraryGenerator()(tree, options);

    expect(readJson(tree, 'tsconfig.base.json').compilerOptions.paths).toEqual({
      '@cybertecpty/zzz-existing': ['./tools/zzz/existing/src/index.ts'],
      '@cybertecpty/billing-models': ['./libs/billing/models/src/index.ts']
    });
  });

  it("writes the project's `tsconfig.lib.json` when given one", async () => {
    const tree = createWorkspaceTreeFixture();
    const tsConfigLib = { compilerOptions: { types: ['node'] } };

    await createFakeLibraryGenerator({ tsConfigLib })(tree, options);

    expect(readJson(tree, 'libs/billing/models/tsconfig.lib.json')).toEqual(tsConfigLib);
  });

  it('writes no `tsconfig.lib.json` by default', async () => {
    const tree = createWorkspaceTreeFixture();

    await createFakeLibraryGenerator()(tree, options);

    expect(tree.exists('libs/billing/models/tsconfig.lib.json')).toBe(false);
  });

  it('returns a no-op task', async () => {
    const tree = createWorkspaceTreeFixture();

    const task = await createFakeLibraryGenerator()(tree, options);

    expect(task()).toBeUndefined();
  });
});
