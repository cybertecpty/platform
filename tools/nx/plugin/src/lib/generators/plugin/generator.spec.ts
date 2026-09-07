import * as devkit from '@nx/devkit';
import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { pluginGenerator as nxPluginGenerator } from '@nx/plugin/generators';
import { pluginGenerator } from './generator';
import { NxPluginGeneratorOptions } from './schema';

jest.mock('@nx/plugin/generators', () => ({
  pluginGenerator: jest.fn(() => Promise.resolve(jest.fn()))
}));

const nxPluginGeneratorMock = nxPluginGenerator as jest.MockedFunction<typeof nxPluginGenerator>;

function run(tree: Tree, options: Partial<NxPluginGeneratorOptions> & { group: string }) {
  return pluginGenerator(tree, options);
}

/** The options `@nx/plugin:plugin` was called with on the most recent run. */
function forwardedOptions() {
  const lastCall = nxPluginGeneratorMock.mock.calls.at(-1);

  if (!lastCall) {
    throw new Error('`@nx/plugin:plugin` was never called');
  }

  return lastCall[1];
}

describe('pluginGenerator', () => {
  let tree: Tree;
  let formatFiles: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    tree = createTreeWithEmptyWorkspace();
    formatFiles = jest.spyOn(devkit, 'formatFiles').mockResolvedValue();
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

  describe('option passthrough and defaults', () => {
    it('applies the workspace defaults when options are omitted', async () => {
      await run(tree, { group: 'demo' });

      expect(forwardedOptions()).toMatchObject({
        linter: 'eslint',
        unitTestRunner: 'jest',
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

    it('returns the delegated task wrapped in a serial runner', async () => {
      const task = jest.fn();
      nxPluginGeneratorMock.mockResolvedValueOnce(task);

      const callback = await run(tree, { group: 'demo' });
      await callback();

      expect(task).toHaveBeenCalledTimes(1);
    });
  });
});
