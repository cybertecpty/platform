import type { Tree } from '@nx/devkit';
import { updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import type { TsConfigJson } from 'type-fest';

export interface CreateWorkspaceTreeFixtureOptions {
  /** `compilerOptions.paths` entries to seed `tsconfig.base.json` with. */
  tsConfigPaths?: Record<string, string[]>;
}

/**
 * Build an empty workspace `Tree` fixture for generator specs, with
 * `tsconfig.base.json` paths seeded from the given entries.
 */
export const createWorkspaceTreeFixture = ({
  tsConfigPaths = {}
}: CreateWorkspaceTreeFixtureOptions = {}): Tree => {
  const tree = createTreeWithEmptyWorkspace();

  updateJson<TsConfigJson>(tree, 'tsconfig.base.json', json => ({
    ...json,
    compilerOptions: { ...json.compilerOptions, paths: tsConfigPaths }
  }));

  return tree;
};
