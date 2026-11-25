import { createDependencyGraphFixture, createProjectNodeFixture } from '@cybertecpty/nx-testing';
import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { collectProjectDependencies, readProjectPackageJson } from './project-dependencies';

describe('project-dependencies', () => {
  describe('collectProjectDependencies', () => {
    const graph = createDependencyGraphFixture(
      [
        createProjectNodeFixture({ name: 'web', type: 'app' }),
        createProjectNodeFixture({ name: 'ui' }),
        createProjectNodeFixture({ name: 'core' }),
        createProjectNodeFixture({ name: 'unrelated' })
      ],
      [
        ['web', 'ui'],
        ['ui', 'core'],
        ['web', 'npm:react']
      ]
    );

    it('follows workspace dependencies transitively and skips external packages', () => {
      expect(collectProjectDependencies(graph, 'web')).toEqual(['ui', 'core']);
    });

    it('returns nothing for a project that depends on nothing', () => {
      expect(collectProjectDependencies(graph, 'unrelated')).toEqual([]);
    });

    it('returns nothing for a project that is not in the graph', () => {
      expect(collectProjectDependencies(graph, 'missing')).toEqual([]);
    });

    it('survives a dependency cycle without listing the project itself', () => {
      const cyclic = createDependencyGraphFixture(
        [
          createProjectNodeFixture({ name: 'a', type: 'app' }),
          createProjectNodeFixture({ name: 'b' })
        ],
        [
          ['a', 'b'],
          ['b', 'a']
        ]
      );

      expect(collectProjectDependencies(cyclic, 'a')).toEqual(['b']);
    });
  });

  describe('readProjectPackageJson', () => {
    const projectRoot = 'libs/demo/utils';
    let tree: Tree;

    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();
    });

    it('returns the parsed package.json in the project root', () => {
      tree.write(`${projectRoot}/package.json`, JSON.stringify({ name: '@proj/demo-utils' }));

      expect(readProjectPackageJson(tree, projectRoot)).toEqual({ name: '@proj/demo-utils' });
    });

    it('returns undefined when the project has no package.json', () => {
      expect(readProjectPackageJson(tree, projectRoot)).toBeUndefined();
    });

    it('throws when the package.json is not valid JSON', () => {
      tree.write(`${projectRoot}/package.json`, '{ not valid json');

      expect(() => readProjectPackageJson(tree, projectRoot)).toThrow();
    });
  });
});
