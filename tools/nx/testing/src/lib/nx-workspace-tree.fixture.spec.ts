import { readJson } from '@nx/devkit';
import { createWorkspaceTreeFixture } from './nx-workspace-tree.fixture';

describe('createWorkspaceTreeFixture', () => {
  it('seeds `tsconfig.base.json` paths from the given entries', () => {
    const tree = createWorkspaceTreeFixture({
      tsConfigPaths: { '@cybertecpty/existing': ['./tools/existing/src/index.ts'] }
    });

    expect(readJson(tree, 'tsconfig.base.json').compilerOptions.paths).toEqual({
      '@cybertecpty/existing': ['./tools/existing/src/index.ts']
    });
  });

  it('seeds no paths by default', () => {
    const tree = createWorkspaceTreeFixture();

    expect(readJson(tree, 'tsconfig.base.json').compilerOptions.paths).toEqual({});
  });

  it('is an otherwise empty workspace', () => {
    const tree = createWorkspaceTreeFixture();

    expect(tree.exists('nx.json')).toBe(true);
    expect(readJson(tree, 'package.json')).toBeDefined();
  });
});
