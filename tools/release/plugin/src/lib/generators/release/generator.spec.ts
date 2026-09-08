import { logger, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { releaseGenerator } from './generator';
import type { ReleaseGeneratorOptions } from './schema';

describe('releaseGenerator', () => {
  let tree: Tree;
  const options: ReleaseGeneratorOptions = { name: 'test' };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    jest.spyOn(logger, 'info').mockImplementation(() => undefined);
  });

  it('runs without throwing', async () => {
    await expect(releaseGenerator(tree, options)).resolves.toBeUndefined();
  });
});
