import { writeJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  getWorkspaceScope,
  readWorkspaceDependencies,
  readWorkspacePackageJson
} from './workspace';

describe('workspace', () => {
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

    it('throws when the root package.json is not valid JSON', () => {
      tree.write('package.json', '{ not valid json');

      expect(() => getWorkspaceScope(tree)).toThrow();
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

  describe('readWorkspacePackageJson', () => {
    let tree: Tree;

    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();
    });

    it('returns the parsed root package.json when present', () => {
      expect(readWorkspacePackageJson(tree)).toEqual({
        name: '@proj/source',
        dependencies: {},
        devDependencies: {}
      });
    });

    it('returns null when the root package.json does not exist', () => {
      tree.delete('package.json');

      expect(readWorkspacePackageJson(tree)).toBeNull();
    });

    it('throws when the root package.json is not valid JSON', () => {
      tree.write('package.json', '{ not valid json');

      expect(() => readWorkspacePackageJson(tree)).toThrow();
    });
  });

  describe('readWorkspaceDependencies', () => {
    let tree: Tree;

    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();
    });

    it('returns the `dependencies` and `devDependencies` of the root package.json', () => {
      writeJson(tree, 'package.json', {
        name: '@proj/source',
        dependencies: { tslib: '^2.3.0' },
        devDependencies: { vitest: '^5.0.1' }
      });

      expect(readWorkspaceDependencies(tree)).toEqual({
        dependencies: { tslib: '^2.3.0' },
        devDependencies: { vitest: '^5.0.1' }
      });
    });

    it('returns an empty object for a map the root package.json does not have', () => {
      writeJson(tree, 'package.json', {
        name: '@proj/source',
        devDependencies: { vitest: '^5.0.1' }
      });

      expect(readWorkspaceDependencies(tree)).toEqual({
        dependencies: {},
        devDependencies: { vitest: '^5.0.1' }
      });
    });

    it('returns null when the root package.json does not exist', () => {
      tree.delete('package.json');

      expect(readWorkspaceDependencies(tree)).toBeNull();
    });

    it('throws when the root package.json is not valid JSON', () => {
      tree.write('package.json', '{ not valid json');

      expect(() => readWorkspaceDependencies(tree)).toThrow();
    });
  });
});
