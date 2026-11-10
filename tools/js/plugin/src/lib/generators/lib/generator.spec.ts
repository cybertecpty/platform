import { createFakeLibraryGenerator, createWorkspaceTreeFixture } from '@cybertecpty/nx-testing';
import { lastCallArg } from '@cybertecpty/vitest-testing';
import type { Tree } from '@nx/devkit';
import * as devkit from '@nx/devkit';
import { addProjectConfiguration, readJson } from '@nx/devkit';
import { libraryGenerator as nxJsLibraryGenerator } from '@nx/js';
import { MockInstance, vi, type MockedFunction } from 'vitest';
import { libGenerator } from './generator';
import type { LibGeneratorOptions } from './schema';

vi.mock('@nx/js', () => ({
  libraryGenerator: vi.fn()
}));

const nxJsLibraryGeneratorMock = nxJsLibraryGenerator as MockedFunction<
  typeof nxJsLibraryGenerator
>;

/** Stand-in for `@nx/js:library`, which also writes the `tsconfig.lib.json` the real one would. */
const fakeNxJsLibraryGenerator = createFakeLibraryGenerator({
  tsConfigLib: {
    compilerOptions: { outDir: '../../../dist/out-tsc', declaration: true, types: ['node'] }
  }
});

/** The options `@nx/js:library` was called with on the most recent run. */
function forwardedOptions() {
  return lastCallArg(nxJsLibraryGeneratorMock, 1, '`@nx/js:library`');
}

function run(
  tree: Tree,
  options: Partial<LibGeneratorOptions> & Pick<LibGeneratorOptions, 'type'>
) {
  return libGenerator(tree, options);
}

describe('libGenerator', () => {
  let tree: Tree;
  let formatFiles: MockInstance;
  let loggerWarn: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    tree = createWorkspaceTreeFixture({
      tsConfigPaths: { '@cybertecpty/zzz-existing': ['./tools/zzz/existing/src/index.ts'] }
    });
    formatFiles = vi.spyOn(devkit, 'formatFiles').mockResolvedValue();
    loggerWarn = vi.spyOn(devkit.logger, 'warn').mockImplementation(() => undefined);
    nxJsLibraryGeneratorMock.mockImplementation(
      fakeNxJsLibraryGenerator as unknown as typeof nxJsLibraryGenerator
    );
  });

  describe('project-option normalization', () => {
    it('derives the name and directory from `domain`/`platform`/`type` per ADR 0009', async () => {
      await run(tree, { domain: 'billing', platform: 'backend', type: 'models' });

      expect(forwardedOptions()).toMatchObject({
        name: 'billing-models',
        directory: 'libs/billing/models'
      });
    });

    it('derives the name and directory with an explicit `group`', async () => {
      await run(tree, {
        domain: 'billing',
        platform: 'backend',
        type: 'utils',
        group: 'orchestration'
      });

      expect(forwardedOptions()).toMatchObject({
        name: 'billing-orchestration-utils',
        directory: 'libs/billing/orchestration/utils'
      });
    });

    it('derives the name and directory from a multi-segment (subdomain) domain', async () => {
      await run(tree, { domain: 'billing/checkout', platform: 'shared', type: 'models' });

      expect(forwardedOptions()).toMatchObject({
        name: 'billing-checkout-models',
        directory: 'libs/billing/checkout/models'
      });
    });

    it('takes `name` as a literal override while still deriving the directory from `domain`/`type`', async () => {
      await run(tree, {
        domain: 'billing',
        platform: 'backend',
        type: 'models',
        name: 'legacy-billing-models'
      });

      expect(forwardedOptions()).toMatchObject({
        name: 'legacy-billing-models',
        directory: 'libs/billing/models'
      });
    });

    it('forwards the derived tags, compounding a multi-segment domain into one hyphenated tag', async () => {
      await run(tree, { domain: 'billing/checkout', platform: 'backend', type: 'models' });

      expect(forwardedOptions().tags).toBe('domain:billing-checkout,platform:backend,type:models');
    });

    it('appends key:value freeform tags after the derived ones', async () => {
      await run(tree, {
        domain: 'billing',
        platform: 'shared',
        type: 'types',
        tags: 'lint:strict'
      });

      expect(forwardedOptions().tags).toBe('domain:billing,lint:strict,platform:shared,type:types');
    });

    it('rejects a malformed `domain` before delegating', async () => {
      await expect(
        run(tree, { domain: 'Billing', platform: 'backend', type: 'models' })
      ).rejects.toThrow('must be lowercase alphanumeric words joined by single hyphens');
      expect(nxJsLibraryGeneratorMock).not.toHaveBeenCalled();
    });

    it('rejects a doubled-slash `domain` before delegating', async () => {
      await expect(
        run(tree, { domain: 'billing//checkout', platform: 'backend', type: 'models' })
      ).rejects.toThrow('must be lowercase alphanumeric words joined by single hyphens');
      expect(nxJsLibraryGeneratorMock).not.toHaveBeenCalled();
    });

    it('rejects a malformed `group` before delegating', async () => {
      await expect(
        run(tree, { domain: 'billing', platform: 'backend', type: 'utils', group: 'Bad_Group' })
      ).rejects.toThrow('must be lowercase alphanumeric words joined by single hyphens');
      expect(nxJsLibraryGeneratorMock).not.toHaveBeenCalled();
    });
  });

  describe('backend library types', () => {
    it.each(['api', 'services', 'infra'] as const)(
      'rejects `type:%s`, pointing to `dotnet new` and ADR 0017',
      async type => {
        const result = run(tree, { domain: 'billing', platform: 'backend', type });

        await expect(result).rejects.toThrow('`dotnet new`');
        await expect(result).rejects.toThrow('ADR 0017');
        expect(nxJsLibraryGeneratorMock).not.toHaveBeenCalled();
      }
    );
  });

  describe('platform resolution', () => {
    it('rejects a missing `platform`', async () => {
      await expect(run(tree, { domain: 'billing', type: 'utils' })).rejects.toThrow(
        '`platform` must be provided'
      );
      expect(nxJsLibraryGeneratorMock).not.toHaveBeenCalled();
    });
  });

  describe('`platform:tools` projects', () => {
    it('places a tools library under `tools/[<group>/]<type>` with no `domain:` tag', async () => {
      await run(tree, { platform: 'tools', group: 'nx', type: 'testing' });

      expect(forwardedOptions()).toMatchObject({
        name: 'nx-testing',
        directory: 'tools/nx/testing',
        tags: 'platform:tools,type:testing'
      });
    });

    it('rejects a `domain` for a tools library — tools projects are domain-exempt', async () => {
      await expect(
        run(tree, { domain: 'billing', platform: 'tools', group: 'nx', type: 'utils' })
      ).rejects.toThrow('`domain` cannot be set for `platform:tools`');
      expect(nxJsLibraryGeneratorMock).not.toHaveBeenCalled();
    });

    it('rejects a missing `domain` for every platform except `tools`', async () => {
      await expect(run(tree, { platform: 'backend', type: 'utils' })).rejects.toThrow(
        '`domain` must be provided for every `platform` except `tools`'
      );
      expect(nxJsLibraryGeneratorMock).not.toHaveBeenCalled();
    });
  });

  describe('unit-test runner', () => {
    it('rejects `unitTestRunner: jest`, pointing to ADR 0018, before delegating', async () => {
      const result = run(tree, {
        domain: 'billing',
        platform: 'backend',
        type: 'models',
        unitTestRunner: 'jest' as 'vitest'
      });

      await expect(result).rejects.toThrow('ADR 0018');
      expect(nxJsLibraryGeneratorMock).not.toHaveBeenCalled();
    });

    it('writes a Vitest config extending the base config and no Jest config', async () => {
      await run(tree, {
        domain: 'billing',
        platform: 'backend',
        type: 'models',
        testEnvironment: 'jsdom'
      });

      const config = tree.read('libs/billing/models/vitest.config.mts', 'utf-8');

      expect(config).toContain('createBaseVitestConfig');
      expect(config).toContain("name: 'billing-models'");
      expect(config).toContain("environment: 'jsdom'");
      expect(tree.exists('libs/billing/models/jest.config.cts')).toBe(false);
    });

    it('writes no Vitest config when there is no unit-test runner', async () => {
      await run(tree, {
        domain: 'billing',
        platform: 'backend',
        type: 'models',
        unitTestRunner: 'none'
      });

      expect(tree.exists('libs/billing/models/vitest.config.mts')).toBe(false);
    });
  });

  describe('option passthrough and defaults', () => {
    it('applies the workspace defaults when options are omitted', async () => {
      await run(tree, { domain: 'billing', platform: 'backend', type: 'models' });

      expect(forwardedOptions()).toMatchObject({
        bundler: 'none',
        linter: 'eslint',
        unitTestRunner: 'vitest',
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
        platform: 'backend',
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
      await run(tree, { domain: 'billing', platform: 'backend', type: 'models' });

      expect(forwardedOptions().skipFormat).toBe(true);
      expect(formatFiles).toHaveBeenCalledTimes(1);
    });

    it('skips formatting when `skipFormat` is set', async () => {
      await run(tree, { domain: 'billing', platform: 'backend', type: 'models', skipFormat: true });

      expect(formatFiles).not.toHaveBeenCalled();
    });

    it('re-sorts `tsconfig.base.json` paths alphabetically after delegating', async () => {
      await run(tree, { domain: 'billing', platform: 'backend', type: 'models' });

      const { paths } = readJson(tree, 'tsconfig.base.json').compilerOptions;
      expect(Object.keys(paths)).toEqual([
        '@cybertecpty/billing-models',
        '@cybertecpty/zzz-existing'
      ]);
    });

    it('adds a `typecheck` target stub that inherits from nx.json target defaults', async () => {
      await run(tree, { domain: 'billing', platform: 'backend', type: 'models' });

      const { targets } = devkit.readProjectConfiguration(tree, 'billing-models');

      expect(targets?.typecheck).toEqual({});
      expect(targets?.build).toBeDefined();
    });

    it('skips the `typecheck` stub when there is no unit-test runner', async () => {
      await run(tree, {
        domain: 'billing',
        platform: 'backend',
        type: 'models',
        unitTestRunner: 'none'
      });

      const { targets } = devkit.readProjectConfiguration(tree, 'billing-models');

      expect(targets?.typecheck).toBeUndefined();
    });

    it("adds `vitest/globals` to `tsconfig.lib.json`'s `compilerOptions.types` for a `type:testing` library", async () => {
      await run(tree, { domain: 'billing', platform: 'backend', type: 'testing' });

      const tsConfig = readJson(tree, 'libs/billing/testing/tsconfig.lib.json');

      expect(tsConfig.compilerOptions.types).toEqual(['node', 'vitest/globals']);
    });

    it('does not touch `tsconfig.lib.json` types for a non-testing library', async () => {
      await run(tree, { domain: 'billing', platform: 'backend', type: 'models' });

      const tsConfig = readJson(tree, 'libs/billing/models/tsconfig.lib.json');

      expect(tsConfig.compilerOptions.types).toEqual(['node']);
    });

    it('drops `node` from `tsconfig.lib.json` types for a `platform:shared` library (ADR 0004)', async () => {
      await run(tree, { domain: 'billing', platform: 'shared', type: 'models' });

      const tsConfig = readJson(tree, 'libs/billing/models/tsconfig.lib.json');

      expect(tsConfig.compilerOptions.types).toEqual([]);
    });

    it('keeps `vitest/globals` but drops `node` for a `platform:shared` `type:testing` library', async () => {
      await run(tree, { domain: 'billing', platform: 'shared', type: 'testing' });

      const tsConfig = readJson(tree, 'libs/billing/testing/tsconfig.lib.json');

      expect(tsConfig.compilerOptions.types).toEqual(['vitest/globals']);
    });

    it('rejects `unitTestRunner: none` for a `platform:shared` library, which would get no `typecheck`', async () => {
      await expect(
        run(tree, { domain: 'billing', platform: 'shared', type: 'models', unitTestRunner: 'none' })
      ).rejects.toThrow('`unitTestRunner: none` is not allowed for `platform:shared`');
      expect(nxJsLibraryGeneratorMock).not.toHaveBeenCalled();
    });

    it('forces a `type:testing` library to `bundler: none` even when a buildable bundler is requested', async () => {
      await run(tree, {
        domain: 'billing',
        platform: 'backend',
        type: 'testing',
        bundler: 'tsc'
      });

      expect(forwardedOptions().bundler).toBe('none');
      expect(loggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('"testing" library type cannot be buildable')
      );
    });

    it('does not warn when a `type:testing` library already requests `bundler: none`', async () => {
      await run(tree, { domain: 'billing', platform: 'backend', type: 'testing' });

      expect(forwardedOptions().bundler).toBe('none');
      expect(loggerWarn).not.toHaveBeenCalled();
    });

    it('leaves a non-testing library’s requested bundler untouched', async () => {
      await run(tree, {
        domain: 'billing',
        platform: 'backend',
        type: 'models',
        bundler: 'tsc'
      });

      expect(forwardedOptions().bundler).toBe('tsc');
      expect(loggerWarn).not.toHaveBeenCalled();
    });

    it('returns the delegated task wrapped in a serial runner', async () => {
      const task = vi.fn();
      nxJsLibraryGeneratorMock.mockImplementationOnce(((
        tree: Tree,
        options: { name: string; directory: string }
      ) => {
        addProjectConfiguration(tree, options.name, { root: options.directory, targets: {} });
        return Promise.resolve(task);
      }) as unknown as typeof nxJsLibraryGenerator);

      const callback = await run(tree, { domain: 'billing', platform: 'backend', type: 'models' });
      await callback();

      expect(task).toHaveBeenCalledTimes(1);
    });
  });
});
