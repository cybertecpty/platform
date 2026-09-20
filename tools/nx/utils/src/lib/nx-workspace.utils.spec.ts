import { writeJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { getWorkspaceScope, readRootPackageJson } from './nx-workspace.utils';

describe('readRootPackageJson', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('returns the parsed root package.json when present', () => {
    expect(readRootPackageJson(tree)).toEqual({
      name: '@proj/source',
      dependencies: {},
      devDependencies: {}
    });
  });

  it('returns null when the root package.json does not exist', () => {
    tree.delete('package.json');

    expect(readRootPackageJson(tree)).toBeNull();
  });

  it('returns null when the root package.json is not valid JSON', () => {
    tree.write('package.json', '{ not valid json');

    expect(readRootPackageJson(tree)).toBeNull();
  });
});

describe('getWorkspaceScope', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('returns the scope derived from a scoped root package.json name', () => {
    writeJson(tree, 'package.json', { name: '@cybertecpty/workspace' });

    expect(getWorkspaceScope(tree)).toBe('@cybertecpty');
  });

  it('throws when the root package.json does not exist', () => {
    tree.delete('package.json');

    expect(() => getWorkspaceScope(tree)).toThrow('Unable to determine workspace npm scope');
  });

  it('throws when the root package.json has no name field', () => {
    writeJson(tree, 'package.json', {});

    expect(() => getWorkspaceScope(tree)).toThrow('Unable to determine workspace npm scope');
  });

  it('throws when the root package.json name is not scoped', () => {
    writeJson(tree, 'package.json', { name: 'workspace' });

    expect(() => getWorkspaceScope(tree)).toThrow('Unable to determine workspace npm scope');
  });
});
