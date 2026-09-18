import * as devkit from '@nx/devkit';
import { addProjectConfiguration, readJson, Tree, updateJson, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { libraryGenerator as nxJsLibraryGenerator } from '@nx/js';
import { libGenerator } from './generator';
import { LibGeneratorOptions } from './schema';

jest.mock('@nx/js', () => ({
  libraryGenerator: jest.fn()
}));

const nxJsLibraryGeneratorMock = nxJsLibraryGenerator as jest.MockedFunction<
  typeof nxJsLibraryGenerator
>;

/**
 * Stand-in for `@nx/js:library`: writes the minimal project config and
 * `tsconfig.lib.json` the real generator would, appends the new project's
 * path entry to `tsconfig.base.json` (unsorted, same as the real generator),
 * so the wrapper's post-delegation edits have a project (and tsconfigs) to
 * read, then returns a no-op task.
 */
function fakeNxJsLibraryGenerator(tree: Tree, options: { name: string; directory: string }) {
  addProjectConfiguration(tree, options.name, {
    root: options.directory,
    projectType: 'library',
    targets: { build: {} }
  });
  writeJson(tree, `${options.directory}/tsconfig.lib.json`, {
    compilerOptions: { outDir: '../../../dist/out-tsc', declaration: true, types: ['node'] }
  });
  updateJson(tree, 'tsconfig.base.json', json => {
    json.compilerOptions.paths = {
      ...json.compilerOptions.paths,
      [`@cybertecpty/${options.name}`]: [`./${options.directory}/src/index.ts`]
    };

    return json;
  });

  return Promise.resolve(jest.fn());
}

function run(
  tree: Tree,
  options: Partial<LibGeneratorOptions> & Pick<LibGeneratorOptions, 'domain' | 'scope' | 'type'>
) {
  return libGenerator(tree, options);
}

/** The options `@nx/js:library` was called with on the most recent run. */
function forwardedOptions() {
  const lastCall = nxJsLibraryGeneratorMock.mock.calls.at(-1);

  if (!lastCall) {
    throw new Error('`@nx/js:library` was never called');
  }

  return lastCall[1];
}

describe('libGenerator', () => {
  let tree: Tree;
  let formatFiles: jest.SpyInstance;
  let loggerWarn: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    tree = createTreeWithEmptyWorkspace();
    writeJson(tree, 'tsconfig.base.json', {
      compilerOptions: {
        paths: { '@cybertecpty/zzz-existing': ['./tools/zzz/existing/src/index.ts'] }
      }
    });
    formatFiles = jest.spyOn(devkit, 'formatFiles').mockResolvedValue();
    loggerWarn = jest.spyOn(devkit.logger, 'warn').mockImplementation(() => undefined);
    nxJsLibraryGeneratorMock.mockImplementation(
      fakeNxJsLibraryGenerator as unknown as typeof nxJsLibraryGenerator
    );
  });

  describe('project-option normalization', () => {
    it('derives the name and directory from `domain`/`scope`/`type` per ADR 0009', async () => {
      await run(tree, { domain: 'billing', scope: 'backend', type: 'models' });

      expect(forwardedOptions()).toMatchObject({
        name: 'billing-models',
        directory: 'libs/billing/models'
      });
    });

    it('derives the name and directory with an explicit `group`', async () => {
      await run(tree, {
        domain: 'billing',
        scope: 'backend',
        type: 'utils',
        group: 'orchestration'
      });

      expect(forwardedOptions()).toMatchObject({
        name: 'billing-orchestration-utils',
        directory: 'libs/billing/orchestration/utils'
      });
    });

    it('derives the name and directory from a multi-segment (subdomain) domain', async () => {
      await run(tree, { domain: 'billing/checkout', scope: 'shared', type: 'models' });

      expect(forwardedOptions()).toMatchObject({
        name: 'billing-checkout-models',
        directory: 'libs/billing/checkout/models'
      });
    });

    it('takes `name` as a literal override while still deriving the directory from `domain`/`type`', async () => {
      await run(tree, {
        domain: 'billing',
        scope: 'backend',
        type: 'models',
        name: 'legacy-billing-models'
      });

      expect(forwardedOptions()).toMatchObject({
        name: 'legacy-billing-models',
        directory: 'libs/billing/models'
      });
    });

    it('forwards the derived tags, compounding a multi-segment domain into one hyphenated tag', async () => {
      await run(tree, { domain: 'billing/checkout', scope: 'backend', type: 'models' });

      expect(forwardedOptions().tags).toBe('domain:billing-checkout,scope:backend,type:models');
    });

    it('appends key:value freeform tags after the derived ones', async () => {
      await run(tree, { domain: 'billing', scope: 'shared', type: 'types', tags: 'lint:strict' });

      expect(forwardedOptions().tags).toBe('domain:billing,lint:strict,scope:shared,type:types');
    });

    it('rejects a malformed `domain` before delegating', async () => {
      await expect(
        run(tree, { domain: 'Billing', scope: 'backend', type: 'models' })
      ).rejects.toThrow('must be lowercase alphanumeric words joined by single hyphens');
      expect(nxJsLibraryGeneratorMock).not.toHaveBeenCalled();
    });

    it('rejects a doubled-slash `domain` before delegating', async () => {
      await expect(
        run(tree, { domain: 'billing//checkout', scope: 'backend', type: 'models' })
      ).rejects.toThrow('must be lowercase alphanumeric words joined by single hyphens');
      expect(nxJsLibraryGeneratorMock).not.toHaveBeenCalled();
    });

    it('rejects a malformed `group` before delegating', async () => {
      await expect(
        run(tree, { domain: 'billing', scope: 'backend', type: 'utils', group: 'Bad_Group' })
      ).rejects.toThrow('must be lowercase alphanumeric words joined by single hyphens');
      expect(nxJsLibraryGeneratorMock).not.toHaveBeenCalled();
    });
  });

  describe('option passthrough and defaults', () => {
    it('applies the workspace defaults when options are omitted', async () => {
      await run(tree, { domain: 'billing', scope: 'backend', type: 'models' });

      expect(forwardedOptions()).toMatchObject({
        bundler: 'none',
        linter: 'eslint',
        unitTestRunner: 'jest',
        publishable: false,
        enableTypedLinting: false,
        skipTsConfig: false,
        skipPackageJson: false,
        skipTypeCheck: false,
        testEnvironment: 'node',
        strict: true,
        minimal: false,
        skipFormat: true
      });
    });

    it('forwards explicit options unchanged', async () => {
      await run(tree, {
        domain: 'billing',
        scope: 'backend',
        type: 'models',
        bundler: 'tsc',
        linter: 'none',
        unitTestRunner: 'none',
        publishable: true,
        importPath: '@cybertecpty/billing-models',
        useProjectJson: true,
        enableTypedLinting: true,
        skipTsConfig: true,
        skipPackageJson: true,
        skipTypeCheck: true,
        includeBabelRc: true,
        testEnvironment: 'jsdom',
        strict: false,
        minimal: true
      });

      expect(forwardedOptions()).toMatchObject({
        bundler: 'tsc',
        linter: 'none',
        unitTestRunner: 'none',
        publishable: true,
        importPath: '@cybertecpty/billing-models',
        useProjectJson: true,
        enableTypedLinting: true,
        skipTsConfig: true,
        skipPackageJson: true,
        skipTypeCheck: true,
        includeBabelRc: true,
        testEnvironment: 'jsdom',
        strict: false,
        minimal: true
      });
    });

    it('always delegates formatting so it runs once, after normalization', async () => {
      await run(tree, { domain: 'billing', scope: 'backend', type: 'models' });

      expect(forwardedOptions().skipFormat).toBe(true);
      expect(formatFiles).toHaveBeenCalledTimes(1);
    });

    it('skips formatting when `skipFormat` is set', async () => {
      await run(tree, { domain: 'billing', scope: 'backend', type: 'models', skipFormat: true });

      expect(formatFiles).not.toHaveBeenCalled();
    });

    it('re-sorts `tsconfig.base.json` paths alphabetically after delegating', async () => {
      await run(tree, { domain: 'billing', scope: 'backend', type: 'models' });

      const { paths } = readJson(tree, 'tsconfig.base.json').compilerOptions;
      expect(Object.keys(paths)).toEqual([
        '@cybertecpty/billing-models',
        '@cybertecpty/zzz-existing'
      ]);
    });

    it('adds a `typecheck` target stub that inherits from nx.json target defaults', async () => {
      await run(tree, { domain: 'billing', scope: 'backend', type: 'models' });

      const { targets } = devkit.readProjectConfiguration(tree, 'billing-models');

      expect(targets?.typecheck).toEqual({});
      expect(targets?.build).toBeDefined();
    });

    it('skips the `typecheck` stub when there is no unit-test runner', async () => {
      await run(tree, {
        domain: 'billing',
        scope: 'backend',
        type: 'models',
        unitTestRunner: 'none'
      });

      const { targets } = devkit.readProjectConfiguration(tree, 'billing-models');

      expect(targets?.typecheck).toBeUndefined();
    });

    it("adds `jest` to `tsconfig.lib.json`'s `compilerOptions.types` for a `type:testing` library", async () => {
      await run(tree, { domain: 'billing', scope: 'backend', type: 'testing' });

      const tsConfig = readJson(tree, 'libs/billing/testing/tsconfig.lib.json');

      expect(tsConfig.compilerOptions.types).toEqual(['jest', 'node']);
    });

    it('does not touch `tsconfig.lib.json` types for a non-testing library', async () => {
      await run(tree, { domain: 'billing', scope: 'backend', type: 'models' });

      const tsConfig = readJson(tree, 'libs/billing/models/tsconfig.lib.json');

      expect(tsConfig.compilerOptions.types).toEqual(['node']);
    });

    it('forces a `type:testing` library to `bundler: none` even when a buildable bundler is requested', async () => {
      await run(tree, {
        domain: 'billing',
        scope: 'backend',
        type: 'testing',
        bundler: 'tsc'
      });

      expect(forwardedOptions().bundler).toBe('none');
      expect(loggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('"testing" library type cannot be buildable')
      );
    });

    it('does not warn when a `type:testing` library already requests `bundler: none`', async () => {
      await run(tree, { domain: 'billing', scope: 'backend', type: 'testing' });

      expect(forwardedOptions().bundler).toBe('none');
      expect(loggerWarn).not.toHaveBeenCalled();
    });

    it('leaves a non-testing library’s requested bundler untouched', async () => {
      await run(tree, {
        domain: 'billing',
        scope: 'backend',
        type: 'models',
        bundler: 'tsc'
      });

      expect(forwardedOptions().bundler).toBe('tsc');
      expect(loggerWarn).not.toHaveBeenCalled();
    });

    it('returns the delegated task wrapped in a serial runner', async () => {
      const task = jest.fn();
      nxJsLibraryGeneratorMock.mockImplementationOnce(((
        tree: Tree,
        options: { name: string; directory: string }
      ) => {
        addProjectConfiguration(tree, options.name, { root: options.directory, targets: {} });
        return Promise.resolve(task);
      }) as unknown as typeof nxJsLibraryGenerator);

      const callback = await run(tree, { domain: 'billing', scope: 'backend', type: 'models' });
      await callback();

      expect(task).toHaveBeenCalledTimes(1);
    });
  });
});
