import {
  addProjectConfiguration,
  readJson,
  readProjectConfiguration,
  Tree,
  writeJson
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { addTsConfigTypes, addTypecheckTarget } from './nx-generator.utils';

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

describe('addTypecheckTarget', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'demo', { root: 'libs/demo', targets: { build: {} } });
  });

  it('adds a `typecheck` target stub when there is a unit-test runner', () => {
    addTypecheckTarget(tree, 'demo', 'jest');

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
