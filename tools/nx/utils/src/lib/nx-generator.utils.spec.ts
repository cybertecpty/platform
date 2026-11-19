import type { NxJsonConfiguration, Tree } from '@nx/devkit';
import {
  addProjectConfiguration,
  readJson,
  readNxJson,
  readProjectConfiguration,
  updateNxJson,
  updateProjectConfiguration,
  writeJson
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  addTsConfigTypes,
  addTypecheckTarget,
  removeRedundantLintTarget,
  removeTsConfigTypes,
  sortTsConfigBasePaths
} from './nx-generator.utils';

describe('addTsConfigTypes', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('adds types to a tsconfig with no existing types', () => {
    writeJson(tree, 'libs/demo/tsconfig.lib.json', { compilerOptions: {} });

    addTsConfigTypes(tree, 'libs/demo/tsconfig.lib.json', ['jest']);

    expect(readJson(tree, 'libs/demo/tsconfig.lib.json').compilerOptions.types).toEqual(['jest']);
  });

  it('merges with existing types, deduping and sorting alphabetically', () => {
    writeJson(tree, 'libs/demo/tsconfig.lib.json', { compilerOptions: { types: ['node'] } });

    addTsConfigTypes(tree, 'libs/demo/tsconfig.lib.json', ['jest']);

    expect(readJson(tree, 'libs/demo/tsconfig.lib.json').compilerOptions.types).toEqual([
      'jest',
      'node'
    ]);
  });

  it('does not duplicate a type that is already present', () => {
    writeJson(tree, 'libs/demo/tsconfig.lib.json', {
      compilerOptions: { types: ['jest', 'node'] }
    });

    addTsConfigTypes(tree, 'libs/demo/tsconfig.lib.json', ['jest']);

    expect(readJson(tree, 'libs/demo/tsconfig.lib.json').compilerOptions.types).toEqual([
      'jest',
      'node'
    ]);
  });

  it('creates `compilerOptions` when the tsconfig has none', () => {
    writeJson(tree, 'libs/demo/tsconfig.lib.json', {});

    addTsConfigTypes(tree, 'libs/demo/tsconfig.lib.json', ['jest']);

    expect(readJson(tree, 'libs/demo/tsconfig.lib.json').compilerOptions.types).toEqual(['jest']);
  });

  it('preserves other compilerOptions fields', () => {
    writeJson(tree, 'libs/demo/tsconfig.lib.json', { compilerOptions: { outDir: 'dist' } });

    addTsConfigTypes(tree, 'libs/demo/tsconfig.lib.json', ['jest']);

    expect(readJson(tree, 'libs/demo/tsconfig.lib.json').compilerOptions).toEqual({
      outDir: 'dist',
      types: ['jest']
    });
  });
});

describe('removeTsConfigTypes', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('removes the given types and keeps the rest', () => {
    writeJson(tree, 'libs/demo/tsconfig.lib.json', {
      compilerOptions: { types: ['jest', 'node'] }
    });

    removeTsConfigTypes(tree, 'libs/demo/tsconfig.lib.json', ['node']);

    expect(readJson(tree, 'libs/demo/tsconfig.lib.json').compilerOptions.types).toEqual(['jest']);
  });

  it('leaves an explicit empty array when every type is removed', () => {
    writeJson(tree, 'libs/demo/tsconfig.lib.json', { compilerOptions: { types: ['node'] } });

    removeTsConfigTypes(tree, 'libs/demo/tsconfig.lib.json', ['node']);

    expect(readJson(tree, 'libs/demo/tsconfig.lib.json').compilerOptions.types).toEqual([]);
  });

  it('writes an empty array when the tsconfig sets no types, so no @types package loads', () => {
    writeJson(tree, 'libs/demo/tsconfig.lib.json', { compilerOptions: { outDir: 'dist' } });

    removeTsConfigTypes(tree, 'libs/demo/tsconfig.lib.json', ['node']);

    expect(readJson(tree, 'libs/demo/tsconfig.lib.json').compilerOptions).toEqual({
      outDir: 'dist',
      types: []
    });
  });
});

describe('addTypecheckTarget', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'demo', { root: 'libs/demo', targets: { build: {} } });
  });

  it('adds a `typecheck` target stub when there is a unit-test runner', () => {
    addTypecheckTarget(tree, 'demo', 'vitest');

    const { targets } = readProjectConfiguration(tree, 'demo');
    expect(targets?.['typecheck']).toEqual({});
    expect(targets?.['build']).toBeDefined();
  });

  it('does nothing when there is no unit-test runner', () => {
    addTypecheckTarget(tree, 'demo', 'none');

    const { targets } = readProjectConfiguration(tree, 'demo');
    expect(targets?.['typecheck']).toBeUndefined();
  });
});

describe('removeRedundantLintTarget', () => {
  const eslintPlugin = { plugin: '@nx/eslint/plugin', options: { targetName: 'lint' } };
  let tree: Tree;

  function registerPlugins(plugins: NxJsonConfiguration['plugins']): void {
    updateNxJson(tree, { ...readNxJson(tree), plugins });
  }

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'demo', {
      root: 'libs/demo',
      targets: { lint: { executor: '@nx/eslint:lint' }, build: {}, typecheck: {} }
    });
  });

  it('removes the explicit `@nx/eslint:lint` target when `@nx/eslint/plugin` is registered', () => {
    registerPlugins([eslintPlugin]);

    removeRedundantLintTarget(tree, 'demo');

    expect(readProjectConfiguration(tree, 'demo').targets).not.toHaveProperty('lint');
  });

  it('keeps the project`s other targets', () => {
    registerPlugins([eslintPlugin]);

    removeRedundantLintTarget(tree, 'demo');

    expect(readProjectConfiguration(tree, 'demo').targets).toEqual({ build: {}, typecheck: {} });
  });

  it('recognizes the plugin registered by name only', () => {
    registerPlugins(['@nx/eslint/plugin']);

    removeRedundantLintTarget(tree, 'demo');

    expect(readProjectConfiguration(tree, 'demo').targets).not.toHaveProperty('lint');
  });

  it('keeps the target when the plugin is not registered', () => {
    registerPlugins([{ plugin: '@nx/vitest', options: { testTargetName: 'test' } }]);

    removeRedundantLintTarget(tree, 'demo');

    expect(readProjectConfiguration(tree, 'demo').targets).toHaveProperty('lint');
  });

  it('keeps the target when `nx.json` has no plugins', () => {
    registerPlugins(undefined);

    removeRedundantLintTarget(tree, 'demo');

    expect(readProjectConfiguration(tree, 'demo').targets).toHaveProperty('lint');
  });

  it('keeps a `lint` target that runs another executor', () => {
    registerPlugins([eslintPlugin]);
    updateProjectConfiguration(tree, 'demo', {
      root: 'libs/demo',
      targets: { lint: { executor: 'nx:run-commands', options: { command: 'eslint .' } } }
    });

    removeRedundantLintTarget(tree, 'demo');

    expect(readProjectConfiguration(tree, 'demo').targets).toHaveProperty('lint');
  });

  it('does nothing for a project without a `lint` target', () => {
    registerPlugins([eslintPlugin]);
    updateProjectConfiguration(tree, 'demo', { root: 'libs/demo', targets: { build: {} } });

    removeRedundantLintTarget(tree, 'demo');

    expect(readProjectConfiguration(tree, 'demo').targets).toEqual({ build: {} });
  });

  it('does nothing for a project without targets', () => {
    registerPlugins([eslintPlugin]);
    updateProjectConfiguration(tree, 'demo', { root: 'libs/demo' });

    expect(() => removeRedundantLintTarget(tree, 'demo')).not.toThrow();
  });
});

describe('sortTsConfigBasePaths', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('sorts an out-of-order paths map alphabetically by key', () => {
    writeJson(tree, 'tsconfig.base.json', {
      compilerOptions: {
        paths: {
          '@cybertecpty/nx-utils': ['./tools/nx/utils/src/index.ts'],
          '@cybertecpty/git-utils': ['./tools/git/utils/src/index.ts'],
          '@cybertecpty/js-plugin': ['./tools/js/plugin/src/index.ts']
        }
      }
    });

    sortTsConfigBasePaths(tree, 'tsconfig.base.json');

    expect(Object.keys(readJson(tree, 'tsconfig.base.json').compilerOptions.paths)).toEqual([
      '@cybertecpty/git-utils',
      '@cybertecpty/js-plugin',
      '@cybertecpty/nx-utils'
    ]);
  });

  it('preserves each path entry’s value while reordering', () => {
    writeJson(tree, 'tsconfig.base.json', {
      compilerOptions: {
        paths: {
          '@cybertecpty/nx-utils': ['./tools/nx/utils/src/index.ts'],
          '@cybertecpty/git-utils': ['./tools/git/utils/src/index.ts']
        }
      }
    });

    sortTsConfigBasePaths(tree, 'tsconfig.base.json');

    expect(readJson(tree, 'tsconfig.base.json').compilerOptions.paths).toEqual({
      '@cybertecpty/git-utils': ['./tools/git/utils/src/index.ts'],
      '@cybertecpty/nx-utils': ['./tools/nx/utils/src/index.ts']
    });
  });

  it('preserves other compilerOptions fields', () => {
    writeJson(tree, 'tsconfig.base.json', {
      compilerOptions: {
        target: 'es2022',
        paths: {
          '@cybertecpty/nx-utils': ['./tools/nx/utils/src/index.ts'],
          '@cybertecpty/git-utils': ['./tools/git/utils/src/index.ts']
        }
      }
    });

    sortTsConfigBasePaths(tree, 'tsconfig.base.json');

    expect(readJson(tree, 'tsconfig.base.json').compilerOptions.target).toBe('es2022');
  });

  it('does nothing when there is no paths map', () => {
    writeJson(tree, 'tsconfig.base.json', { compilerOptions: { target: 'es2022' } });

    expect(() => sortTsConfigBasePaths(tree, 'tsconfig.base.json')).not.toThrow();
    expect(readJson(tree, 'tsconfig.base.json').compilerOptions.paths).toBeUndefined();
  });

  it('defaults to `tsconfig.base.json` at the workspace root', () => {
    writeJson(tree, 'tsconfig.base.json', {
      compilerOptions: {
        paths: {
          '@cybertecpty/nx-utils': ['./tools/nx/utils/src/index.ts'],
          '@cybertecpty/git-utils': ['./tools/git/utils/src/index.ts']
        }
      }
    });

    sortTsConfigBasePaths(tree);

    expect(Object.keys(readJson(tree, 'tsconfig.base.json').compilerOptions.paths)).toEqual([
      '@cybertecpty/git-utils',
      '@cybertecpty/nx-utils'
    ]);
  });
});
