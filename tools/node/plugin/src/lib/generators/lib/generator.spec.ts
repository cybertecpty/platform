import * as devkit from '@nx/devkit';
import { addProjectConfiguration, readJson, Tree, updateJson, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { libraryGenerator as nxNodeLibraryGenerator } from '@nx/node';
import { libGenerator } from './generator';
import { LibGeneratorOptions } from './schema';

jest.mock('@nx/node', () => ({
  libraryGenerator: jest.fn()
}));

const nxNodeLibraryGeneratorMock = nxNodeLibraryGenerator as jest.MockedFunction<
  typeof nxNodeLibraryGenerator
>;

/**
 * Stand-in for `@nx/node:library`: writes the minimal project config and
 * `tsconfig.lib.json` the real generator would, appends the new project's
 * path entry to `tsconfig.base.json` (unsorted, same as the real generator),
 * so the wrapper's post-delegation edits have a project (and tsconfigs) to
 * read, then returns a no-op task.
 */
function fakeNxNodeLibraryGenerator(tree: Tree, options: { name: string; directory: string }) {
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
  options: Partial<LibGeneratorOptions> & Pick<LibGeneratorOptions, 'domain' | 'type'>
) {
  return libGenerator(tree, options);
}

/** The options `@nx/node:library` was called with on the most recent run. */
function forwardedOptions() {
  const lastCall = nxNodeLibraryGeneratorMock.mock.calls.at(-1);

  if (!lastCall) {
    throw new Error('`@nx/node:library` was never called');
  }

  return lastCall[1];
}

describe('libGenerator', () => {
  let tree: Tree;
  let formatFiles: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    tree = createTreeWithEmptyWorkspace();
    writeJson(tree, 'tsconfig.base.json', {
      compilerOptions: {
        paths: { '@cybertecpty/zzz-existing': ['./tools/zzz/existing/src/index.ts'] }
      }
    });
    formatFiles = jest.spyOn(devkit, 'formatFiles').mockResolvedValue();
    nxNodeLibraryGeneratorMock.mockImplementation(
      fakeNxNodeLibraryGenerator as unknown as typeof nxNodeLibraryGenerator
    );
  });

  describe('project-option normalization', () => {
    it('derives the name and directory from `domain`/`type` per ADR 0009', async () => {
      await run(tree, { domain: 'billing', type: 'infra' });

      expect(forwardedOptions()).toMatchObject({
        name: 'billing-infra',
        directory: 'libs/billing/infra'
      });
    });

    it('derives the name and directory with an explicit `group`', async () => {
      await run(tree, { domain: 'billing', type: 'infra', group: 'orchestration' });

      expect(forwardedOptions()).toMatchObject({
        name: 'billing-orchestration-infra',
        directory: 'libs/billing/orchestration/infra'
      });
    });

    it('derives the name and directory from a multi-segment (subdomain) domain', async () => {
      await run(tree, { domain: 'billing/checkout', type: 'infra' });

      expect(forwardedOptions()).toMatchObject({
        name: 'billing-checkout-infra',
        directory: 'libs/billing/checkout/infra'
      });
    });

    it('takes `name` as a literal override while still deriving the directory from `domain`/`type`', async () => {
      await run(tree, { domain: 'billing', type: 'infra', name: 'legacy-billing-infra' });

      expect(forwardedOptions()).toMatchObject({
        name: 'legacy-billing-infra',
        directory: 'libs/billing/infra'
      });
    });

    it('always tags the project `scope:backend`, without accepting it as an input', async () => {
      await run(tree, { domain: 'billing', type: 'infra' });

      expect(forwardedOptions().tags).toBe('domain:billing,scope:backend,type:infra');
    });

    it('forwards the derived tags, compounding a multi-segment domain into one hyphenated tag', async () => {
      await run(tree, { domain: 'billing/checkout', type: 'infra' });

      expect(forwardedOptions().tags).toBe('domain:billing-checkout,scope:backend,type:infra');
    });

    it('appends key:value freeform tags after the derived ones', async () => {
      await run(tree, { domain: 'billing', type: 'infra', tags: 'lint:strict' });

      expect(forwardedOptions().tags).toBe('domain:billing,lint:strict,scope:backend,type:infra');
    });

    it('rejects a malformed `domain` before delegating', async () => {
      await expect(run(tree, { domain: 'Billing', type: 'infra' })).rejects.toThrow(
        'must be lowercase alphanumeric words joined by single hyphens'
      );
      expect(nxNodeLibraryGeneratorMock).not.toHaveBeenCalled();
    });

    it('rejects a doubled-slash `domain` before delegating', async () => {
      await expect(run(tree, { domain: 'billing//checkout', type: 'infra' })).rejects.toThrow(
        'must be lowercase alphanumeric words joined by single hyphens'
      );
      expect(nxNodeLibraryGeneratorMock).not.toHaveBeenCalled();
    });

    it('rejects a malformed `group` before delegating', async () => {
      await expect(
        run(tree, { domain: 'billing', type: 'infra', group: 'Bad_Group' })
      ).rejects.toThrow('must be lowercase alphanumeric words joined by single hyphens');
      expect(nxNodeLibraryGeneratorMock).not.toHaveBeenCalled();
    });
  });

  describe('option passthrough and defaults', () => {
    it('applies the workspace defaults when options are omitted', async () => {
      await run(tree, { domain: 'billing', type: 'infra' });

      expect(forwardedOptions()).toMatchObject({
        linter: 'eslint',
        unitTestRunner: 'jest',
        publishable: false,
        buildable: true,
        compiler: 'tsc',
        simpleModuleName: false,
        babelJest: false,
        strict: true,
        enableTypedLinting: false,
        skipTsConfig: false,
        skipFormat: true
      });
    });

    it('forwards explicit options unchanged', async () => {
      await run(tree, {
        domain: 'billing',
        type: 'infra',
        linter: 'none',
        unitTestRunner: 'none',
        publishable: true,
        buildable: false,
        compiler: 'swc',
        importPath: '@cybertecpty/billing-infra',
        simpleModuleName: true,
        rootDir: 'custom-root',
        babelJest: true,
        strict: false,
        enableTypedLinting: true,
        useProjectJson: true,
        skipTsConfig: true
      });

      expect(forwardedOptions()).toMatchObject({
        linter: 'none',
        unitTestRunner: 'none',
        publishable: true,
        buildable: false,
        compiler: 'swc',
        importPath: '@cybertecpty/billing-infra',
        simpleModuleName: true,
        rootDir: 'custom-root',
        babelJest: true,
        strict: false,
        enableTypedLinting: true,
        useProjectJson: true,
        skipTsConfig: true
      });
    });

    it('always delegates formatting so it runs once, after normalization', async () => {
      await run(tree, { domain: 'billing', type: 'infra' });

      expect(forwardedOptions().skipFormat).toBe(true);
      expect(formatFiles).toHaveBeenCalledTimes(1);
    });

    it('skips formatting when `skipFormat` is set', async () => {
      await run(tree, { domain: 'billing', type: 'infra', skipFormat: true });

      expect(formatFiles).not.toHaveBeenCalled();
    });

    it('re-sorts `tsconfig.base.json` paths alphabetically after delegating', async () => {
      await run(tree, { domain: 'billing', type: 'infra' });

      const { paths } = readJson(tree, 'tsconfig.base.json').compilerOptions;
      expect(Object.keys(paths)).toEqual([
        '@cybertecpty/billing-infra',
        '@cybertecpty/zzz-existing'
      ]);
    });

    it('adds a `typecheck` target stub that inherits from nx.json target defaults', async () => {
      await run(tree, { domain: 'billing', type: 'infra' });

      const { targets } = devkit.readProjectConfiguration(tree, 'billing-infra');

      expect(targets?.typecheck).toEqual({});
      expect(targets?.build).toBeDefined();
    });

    it('skips the `typecheck` stub when there is no unit-test runner', async () => {
      await run(tree, { domain: 'billing', type: 'infra', unitTestRunner: 'none' });

      const { targets } = devkit.readProjectConfiguration(tree, 'billing-infra');

      expect(targets?.typecheck).toBeUndefined();
    });

    it('returns the delegated task wrapped in a serial runner', async () => {
      const task = jest.fn();
      nxNodeLibraryGeneratorMock.mockImplementationOnce(((
        tree: Tree,
        options: { name: string; directory: string }
      ) => {
        addProjectConfiguration(tree, options.name, { root: options.directory, targets: {} });
        return Promise.resolve(task);
      }) as unknown as typeof nxNodeLibraryGenerator);

      const callback = await run(tree, { domain: 'billing', type: 'infra' });
      await callback();

      expect(task).toHaveBeenCalledTimes(1);
    });
  });
});
