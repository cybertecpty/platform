import { lastCallArg } from '@cybertecpty/jest-testing';
import { createFakeLibraryGenerator, createWorkspaceTreeFixture } from '@cybertecpty/nx-testing';
import type { Tree } from '@nx/devkit';
import * as devkit from '@nx/devkit';
import { addProjectConfiguration, readJson } from '@nx/devkit';
import { pluginGenerator as nxPluginGenerator } from '@nx/plugin/generators';
import type { MockedFunction, MockInstance } from 'vitest';
import { pluginGenerator } from './generator';
import type { NxPluginGeneratorOptions } from './schema';

vi.mock('@nx/plugin/generators', () => ({
  pluginGenerator: vi.fn()
}));

const nxPluginGeneratorMock = nxPluginGenerator as MockedFunction<typeof nxPluginGenerator>;

/** Stand-in for `@nx/plugin:plugin`. */
const fakeNxPluginGenerator = createFakeLibraryGenerator();

/** The options `@nx/plugin:plugin` was called with on the most recent run. */
function forwardedOptions() {
  return lastCallArg(nxPluginGeneratorMock, 1, '`@nx/plugin:plugin`');
}

function run(tree: Tree, options: Partial<NxPluginGeneratorOptions> & { group: string }) {
  return pluginGenerator(tree, options);
}

describe('pluginGenerator', () => {
  let tree: Tree;
  let formatFiles: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    tree = createWorkspaceTreeFixture({
      tsConfigPaths: { '@cybertecpty/zzz-existing': ['./tools/zzz/existing/src/index.ts'] }
    });
    formatFiles = vi.spyOn(devkit, 'formatFiles').mockResolvedValue();
    nxPluginGeneratorMock.mockImplementation(
      fakeNxPluginGenerator as unknown as typeof nxPluginGenerator
    );
  });

  describe('project-option normalization', () => {
    it('derives the name and directory from `group` per the tools convention', async () => {
      await run(tree, { group: 'demo' });

      expect(forwardedOptions()).toMatchObject({
        name: 'demo-plugin',
        directory: 'tools/demo/plugin'
      });
    });

    it('takes `name` as a literal override while still deriving the directory from `group`', async () => {
      await run(tree, { group: 'demo', name: 'custom-plugin' });

      expect(forwardedOptions()).toMatchObject({
        name: 'custom-plugin',
        directory: 'tools/demo/plugin'
      });
    });

    it('forwards the derived `scope:tools` / `type:plugin` tag string', async () => {
      await run(tree, { group: 'demo' });

      expect(forwardedOptions().tags).toBe('scope:tools,type:plugin');
    });

    it('appends key:value freeform tags after the derived ones', async () => {
      await run(tree, { group: 'demo', tags: 'lint:strict' });

      expect(forwardedOptions().tags).toBe('lint:strict,scope:tools,type:plugin');
    });

    it('rejects a malformed `group` before delegating', async () => {
      await expect(run(tree, { group: 'Bad_Group' })).rejects.toThrow(
        'must be lowercase alphanumeric words joined by single hyphens'
      );
      expect(nxPluginGeneratorMock).not.toHaveBeenCalled();
    });
  });

  describe('unit-test runner', () => {
    it('rejects `unitTestRunner: jest`, pointing to ADR 0018, before delegating', async () => {
      await expect(
        run(tree, { group: 'demo', unitTestRunner: 'jest' as 'vitest' })
      ).rejects.toThrow('ADR 0018');
      expect(nxPluginGeneratorMock).not.toHaveBeenCalled();
    });

    it('writes a Vitest config extending the base config and no Jest config', async () => {
      await run(tree, { group: 'demo' });

      const config = tree.read('tools/demo/plugin/vitest.config.mts', 'utf-8');

      expect(config).toContain('createBaseVitestConfig');
      expect(config).toContain("environment: 'node'");
      expect(tree.exists('tools/demo/plugin/jest.config.cts')).toBe(false);
    });

    it('writes no Vitest config when there is no unit-test runner', async () => {
      await run(tree, { group: 'demo', unitTestRunner: 'none' });

      expect(tree.exists('tools/demo/plugin/vitest.config.mts')).toBe(false);
    });
  });

  describe('option passthrough and defaults', () => {
    it('applies the workspace defaults when options are omitted', async () => {
      await run(tree, { group: 'demo' });

      expect(forwardedOptions()).toMatchObject({
        linter: 'eslint',
        unitTestRunner: 'vitest',
        compiler: 'tsc',
        e2eTestRunner: 'none',
        publishable: false,
        enableTypedLinting: false,
        skipTsConfig: false,
        skipLintChecks: false,
        skipFormat: true
      });
    });

    it('forwards explicit options unchanged', async () => {
      await run(tree, {
        group: 'demo',
        importPath: '@cybertecpty/demo-plugin',
        compiler: 'swc',
        unitTestRunner: 'none',
        e2eTestRunner: 'jest',
        e2eProjectDirectory: 'tools/demo/plugin-e2e',
        publishable: true,
        useProjectJson: true,
        enableTypedLinting: true
      });

      expect(forwardedOptions()).toMatchObject({
        importPath: '@cybertecpty/demo-plugin',
        compiler: 'swc',
        unitTestRunner: 'none',
        e2eTestRunner: 'jest',
        e2eProjectDirectory: 'tools/demo/plugin-e2e',
        publishable: true,
        useProjectJson: true,
        enableTypedLinting: true
      });
    });

    it('always delegates formatting so it runs once, after normalization', async () => {
      await run(tree, { group: 'demo' });

      expect(forwardedOptions().skipFormat).toBe(true);
      expect(formatFiles).toHaveBeenCalledTimes(1);
    });

    it('skips formatting when `skipFormat` is set', async () => {
      await run(tree, { group: 'demo', skipFormat: true });

      expect(formatFiles).not.toHaveBeenCalled();
    });

    it('re-sorts `tsconfig.base.json` paths alphabetically after delegating', async () => {
      await run(tree, { group: 'demo' });

      const { paths } = readJson(tree, 'tsconfig.base.json').compilerOptions;
      expect(Object.keys(paths)).toEqual(['@cybertecpty/demo-plugin', '@cybertecpty/zzz-existing']);
    });

    it('adds a `typecheck` target stub that inherits from nx.json target defaults', async () => {
      await run(tree, { group: 'demo' });

      const { targets } = devkit.readProjectConfiguration(tree, 'demo-plugin');

      expect(targets?.typecheck).toEqual({});
      expect(targets?.build).toBeDefined();
    });

    it('skips the `typecheck` stub when there is no unit-test runner', async () => {
      await run(tree, { group: 'demo', unitTestRunner: 'none' });

      const { targets } = devkit.readProjectConfiguration(tree, 'demo-plugin');

      expect(targets?.typecheck).toBeUndefined();
    });

    it('scaffolds a `src/lib` folder with a `.gitkeep` so the convention path always exists', async () => {
      await run(tree, { group: 'demo' });

      expect(tree.exists('tools/demo/plugin/src/lib/.gitkeep')).toBe(true);
    });

    it('returns the delegated task wrapped in a serial runner', async () => {
      const task = vi.fn();
      nxPluginGeneratorMock.mockImplementationOnce(((
        tree: Tree,
        options: { name: string; directory: string }
      ) => {
        addProjectConfiguration(tree, options.name, { root: options.directory, targets: {} });
        return Promise.resolve(task);
      }) as unknown as typeof nxPluginGenerator);

      const callback = await run(tree, { group: 'demo' });
      await callback();

      expect(task).toHaveBeenCalledTimes(1);
    });
  });
});
