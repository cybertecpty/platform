import { createProjectGraphFixture } from '@cybertecpty/nx-testing';
import {
  addProjectConfiguration,
  NxJsonConfiguration,
  readNxJson,
  readProjectConfiguration,
  Tree,
  updateNxJson,
  updateProjectConfiguration,
  type ProjectGraph,
  type TargetConfiguration
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  addProjectTarget,
  addTypecheckTarget,
  removeRedundantLintTarget,
  resolveOutputFolder,
  resolveTargetOutputFolder
} from './project-targets';

/** A project graph fixture with one project, `site`, that has the given targets. */
const createGraphFixture = (targets: Record<string, TargetConfiguration>): ProjectGraph =>
  createProjectGraphFixture({ projectName: 'site', projectRoot: 'apps/site', targets });

describe('project-targets', () => {
  describe('addProjectTarget', () => {
    it('adds the target to a project that has no targets', () => {
      const config = addProjectTarget({ root: 'apps/web' }, 'deploy', { executor: 'nx:noop' });

      expect(config.targets).toEqual({ deploy: { executor: 'nx:noop' } });
    });

    it('keeps the existing targets', () => {
      const config = addProjectTarget(
        { root: 'apps/web', targets: { build: { executor: 'nx:noop' } } },
        'deploy',
        { executor: 'nx:noop' }
      );

      expect(Object.keys(config.targets ?? {})).toEqual(['build', 'deploy']);
    });

    it('replaces a target of the same name that runs the same executor', () => {
      const config = addProjectTarget(
        { root: 'apps/web', targets: { deploy: { executor: 'nx:noop', options: { a: 1 } } } },
        'deploy',
        { executor: 'nx:noop', options: { a: 2 } }
      );

      expect(config.targets?.['deploy']).toEqual({ executor: 'nx:noop', options: { a: 2 } });
    });

    it('throws, naming the project, target and executor, when another executor owns the target', () => {
      expect(() =>
        addProjectTarget(
          { name: 'web', root: 'apps/web', targets: { deploy: { executor: 'nx:noop' } } },
          'deploy',
          { executor: 'nx:run-commands' }
        )
      ).toThrow(
        'Project web already has a "deploy" target that runs nx:noop. Rename or remove it first.'
      );
    });

    it('names the project root when the project has no name', () => {
      expect(() =>
        addProjectTarget(
          { root: 'apps/web', targets: { deploy: { executor: 'nx:noop' } } },
          'deploy',
          { executor: 'nx:run-commands' }
        )
      ).toThrow('Project apps/web already has');
    });

    it('replaces a target that runs another executor when replace is set', () => {
      const config = addProjectTarget(
        { root: 'apps/web', targets: { deploy: { executor: 'nx:noop', options: { a: 1 } } } },
        'deploy',
        { executor: 'nx:run-commands' },
        { replace: true }
      );

      expect(config.targets?.['deploy']).toEqual({ executor: 'nx:run-commands' });
    });

    it('returns the project configuration it was given', () => {
      const input = { root: 'apps/web' };

      expect(addProjectTarget(input, 'deploy', { executor: 'nx:noop' })).toBe(input);
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

  describe('resolveTargetOutputFolder', () => {
    it("returns the target's single output with workspace placeholders filled in", () => {
      const graph = createGraphFixture({
        build: { outputs: ['{workspaceRoot}/dist/{projectRoot}'] }
      });

      expect(resolveTargetOutputFolder(graph, 'site', 'build')).toBe('dist/apps/site');
    });

    it("resolves option placeholders with the target's default configuration", () => {
      const graph = createGraphFixture({
        build: {
          outputs: ['{options.outputPath}'],
          options: { outputPath: 'dist/development' },
          configurations: { production: { outputPath: 'dist/production' } },
          defaultConfiguration: 'production'
        }
      });

      expect(resolveTargetOutputFolder(graph, 'site', 'build')).toBe('dist/production');
    });

    it('reads the named target, not only build', () => {
      const graph = createGraphFixture({
        'build-static': { outputs: ['{workspaceRoot}/dist/static'] }
      });

      expect(resolveTargetOutputFolder(graph, 'site', 'build-static')).toBe('dist/static');
    });

    it('throws when the project is not in the graph', () => {
      expect(() => resolveTargetOutputFolder(createGraphFixture({}), 'missing', 'build')).toThrow(
        'missing is not in the project graph.'
      );
    });

    it('throws when the project has no such target', () => {
      expect(() => resolveTargetOutputFolder(createGraphFixture({}), 'site', 'build')).toThrow(
        'site has no "build" target.'
      );
    });

    it.each<[string, TargetConfiguration]>([
      ['no outputs', {}],
      ['an empty outputs list', { outputs: [] }]
    ])('throws when the target declares %s', (_label, build) => {
      expect(() =>
        resolveTargetOutputFolder(createGraphFixture({ build }), 'site', 'build')
      ).toThrow('site:build declares no outputs, so its output folder is unknown.');
    });

    it.each<[string, string[], string]>([
      [
        'several outputs',
        ['{workspaceRoot}/dist/a', '{workspaceRoot}/coverage/a'],
        '["dist/a","coverage/a"]'
      ],
      ['a glob', ['{workspaceRoot}/dist/{projectRoot}/**'], '["dist/apps/site/**"]']
    ])('throws when the target declares %s', (_label, outputs, resolved) => {
      expect(() =>
        resolveTargetOutputFolder(createGraphFixture({ build: { outputs } }), 'site', 'build')
      ).toThrow(`site:build must declare exactly one output folder, but resolves to ${resolved}.`);
    });
  });

  describe('resolveOutputFolder', () => {
    const hint = 'Set the outputPath option.';
    const graph = createGraphFixture({
      build: { outputs: ['{workspaceRoot}/dist/{projectRoot}'] }
    });

    it('returns the explicit folder without reading the build target', () => {
      expect(
        resolveOutputFolder({
          projectGraph: createGraphFixture({}),
          projectName: 'site',
          explicitFolder: 'out/custom',
          buildTarget: 'missing',
          hint
        })
      ).toEqual({ folder: 'out/custom' });
    });

    it("resolves the build target's single output, defaulting the target to build", () => {
      expect(resolveOutputFolder({ projectGraph: graph, projectName: 'site', hint })).toEqual({
        folder: 'dist/apps/site'
      });
    });

    it('reads the target named by buildTarget', () => {
      const projectGraph = createGraphFixture({
        'build-static': { outputs: ['{workspaceRoot}/dist/static'] }
      });

      expect(
        resolveOutputFolder({
          projectGraph,
          projectName: 'site',
          buildTarget: 'build-static',
          hint
        })
      ).toEqual({ folder: 'dist/static' });
    });

    it('returns the original message followed by the hint when resolution fails', () => {
      expect(
        resolveOutputFolder({ projectGraph: createGraphFixture({}), projectName: 'site', hint })
      ).toEqual({ error: `site has no "build" target. ${hint}` });
    });
  });
});
