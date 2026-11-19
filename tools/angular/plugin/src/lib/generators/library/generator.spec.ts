import { createFakeLibraryGenerator, createWorkspaceTreeFixture } from '@cybertecpty/nx-testing';
import { lastCallArg } from '@cybertecpty/vitest-testing';
import { libraryGenerator as nxAngularLibraryGenerator } from '@nx/angular/generators';
import type { Tree } from '@nx/devkit';
import * as devkit from '@nx/devkit';
import {
  readJson,
  readNxJson,
  readProjectConfiguration,
  updateJson,
  updateNxJson,
  updateProjectConfiguration,
  writeJson
} from '@nx/devkit';
import { MockInstance, vi, type MockedFunction } from 'vitest';
import { ngLibGenerator } from './generator';
import type { NgLibGeneratorOptions } from './schema';

vi.mock('@nx/angular/generators', async importOriginal => ({
  ...(await importOriginal<typeof import('@nx/angular/generators')>()),
  libraryGenerator: vi.fn()
}));

const nxAngularLibraryGeneratorMock = nxAngularLibraryGenerator as MockedFunction<
  typeof nxAngularLibraryGenerator
>;

const fakeNxLibraryGenerator = createFakeLibraryGenerator({
  tsConfigLib: { compilerOptions: { outDir: '../../../dist/out-tsc', types: [] } }
});

/**
 * Stand-in for `@nx/angular:library`: besides the project, it writes what the `vitest-analog`
 * scaffold does, including the root `vitest.config.ts`, the `@vitest/ui` dependency and the
 * explicit `lint` target the generator has to clean up, and the routes file of a routed library.
 */
function fakeNxAngularLibraryGenerator(
  tree: Tree,
  schema: { name: string; directory: string; routing?: boolean }
) {
  const task = fakeNxLibraryGenerator(tree, schema);
  const projectConfig = readProjectConfiguration(tree, schema.name);

  if (schema.routing) {
    tree.write(
      `${schema.directory}/src/lib/lib.routes.ts`,
      "import { Route } from '@angular/router';\n\nexport const routes: Route[] = [];\n"
    );
  }

  updateJson(tree, 'package.json', json => ({
    ...json,
    devDependencies: { ...json.devDependencies, '@vitest/ui': '~4.1.0' }
  }));

  updateProjectConfiguration(tree, schema.name, {
    ...projectConfig,
    targets: { ...projectConfig.targets, lint: { executor: '@nx/eslint:lint' } }
  });

  tree.write(`${schema.directory}/vite.config.mts`, 'export default {};');
  tree.write('vitest.config.ts', 'export default {};');
  writeJson(tree, `${schema.directory}/tsconfig.spec.json`, {
    extends: './tsconfig.json',
    compilerOptions: { outDir: '../../../dist/out-tsc', types: ['vitest/globals'] },
    include: ['vite.config.mts', 'vitest.config.mts', 'src/**/*.spec.ts']
  });

  return task;
}

/** The options `@nx/angular:library` was called with on the most recent run. */
function forwardedOptions() {
  return lastCallArg(nxAngularLibraryGeneratorMock, 1, '`@nx/angular:library`');
}

function run(
  tree: Tree,
  options: Partial<NgLibGeneratorOptions> & Pick<NgLibGeneratorOptions, 'type'>
) {
  // Cast: the options type requires a `unitTestRunner`, which the generator defaults when omitted.
  return ngLibGenerator(tree, { domain: 'billing', ...options } as NgLibGeneratorOptions);
}

describe('ngLibGenerator', () => {
  let tree: Tree;
  let formatFiles: MockInstance;
  let loggerWarn: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    tree = createWorkspaceTreeFixture();
    formatFiles = vi.spyOn(devkit, 'formatFiles').mockResolvedValue();
    loggerWarn = vi.spyOn(devkit.logger, 'warn').mockImplementation(() => undefined);
    nxAngularLibraryGeneratorMock.mockImplementation(
      fakeNxAngularLibraryGenerator as unknown as typeof nxAngularLibraryGenerator
    );
  });

  describe('project-option normalization', () => {
    it('derives the name, directory and tags from a subdomain', async () => {
      await run(tree, { type: 'ui', domain: 'billing/checkout' });

      expect(forwardedOptions()).toMatchObject({
        name: 'billing-checkout-ui',
        directory: 'libs/billing/checkout/ui',
        tags: 'domain:billing-checkout,platform:frontend,type:ui'
      });
    });

    it('derives the name, directory and tags and forwards them to `@nx/angular:library`', async () => {
      await run(tree, { type: 'ui' });

      expect(forwardedOptions()).toMatchObject({
        name: 'billing-ui',
        directory: 'libs/billing/ui',
        tags: 'domain:billing,platform:frontend,type:ui'
      });
    });

    it('keeps the workspace-only options away from `@nx/angular:library`', async () => {
      await run(tree, { type: 'ui', group: 'checkout' });

      expect(forwardedOptions()).not.toHaveProperty('domain');
      expect(forwardedOptions()).not.toHaveProperty('group');
      expect(forwardedOptions()).not.toHaveProperty('platform');
      expect(forwardedOptions()).not.toHaveProperty('type');
    });

    it('forwards the options it does not manage unchanged', async () => {
      await run(tree, { type: 'ui', style: 'css', standalone: true, linter: 'none' });

      expect(forwardedOptions()).toMatchObject({
        style: 'css',
        standalone: true,
        linter: 'none'
      });
    });

    it('defaults the selector prefix to `ct`', async () => {
      await run(tree, { type: 'ui' });

      expect(forwardedOptions()).toMatchObject({ prefix: 'ct' });
    });

    it('keeps the selector prefix the caller sets', async () => {
      await run(tree, { type: 'ui', prefix: 'bil' });

      expect(forwardedOptions()).toMatchObject({ prefix: 'bil' });
    });
  });

  describe('per-type options', () => {
    describe('core', () => {
      it('defaults to no routing and no starter component', async () => {
        await run(tree, { type: 'core' });

        expect(forwardedOptions()).toMatchObject({
          routing: false,
          skipModule: true,
          standalone: false
        });
      });

      it('keeps the options the caller sets', async () => {
        await run(tree, { type: 'core', routing: true, skipModule: false, standalone: true });

        expect(forwardedOptions()).toMatchObject({
          routing: true,
          skipModule: false,
          standalone: true
        });
      });
    });

    describe('feature', () => {
      it('defaults to routing and no starter component', async () => {
        await run(tree, { type: 'feature' });

        expect(forwardedOptions()).toMatchObject({
          routing: true,
          skipModule: true,
          standalone: false
        });
      });

      it('keeps the options the caller sets', async () => {
        await run(tree, { type: 'feature', routing: false, standalone: true });

        expect(forwardedOptions()).toMatchObject({ routing: false, standalone: true });
      });
    });

    describe('ui', () => {
      it('defaults to no starter component', async () => {
        await run(tree, { type: 'ui' });

        expect(forwardedOptions()).toMatchObject({
          routing: false,
          skipModule: true,
          standalone: false
        });
        expect(loggerWarn).not.toHaveBeenCalled();
      });

      it('forces routing off and warns', async () => {
        await run(tree, { type: 'ui', routing: true });

        expect(forwardedOptions()).toMatchObject({ routing: false });
        expect(loggerWarn).toHaveBeenCalledWith(expect.stringContaining('UI libraries'));
      });

      it('keeps a starter component the caller asks for', async () => {
        await run(tree, { type: 'ui', standalone: true });

        expect(forwardedOptions()).toMatchObject({ standalone: true });
      });
    });

    describe('data-access', () => {
      it('exports no components, modules or routes, without a warning when nothing was set', async () => {
        await run(tree, { type: 'data-access' });

        expect(forwardedOptions()).toMatchObject({
          routing: false,
          skipModule: true,
          standalone: false
        });
        expect(loggerWarn).not.toHaveBeenCalled();
      });

      it('forces routing off and warns', async () => {
        await run(tree, { type: 'data-access', routing: true });

        expect(forwardedOptions()).toMatchObject({ routing: false });
        expect(loggerWarn).toHaveBeenCalledWith(expect.stringContaining('Routing is not allowed'));
      });

      it.each([{ standalone: true }, { skipModule: false }])(
        'forces components and modules off and warns for %o',
        async options => {
          await run(tree, { type: 'data-access', ...options });

          expect(forwardedOptions()).toMatchObject({ skipModule: true, standalone: false });
          expect(loggerWarn).toHaveBeenCalledWith(
            expect.stringContaining('standalone and skipModule')
          );
        }
      );
    });

    describe('utils', () => {
      it('forces routing, modules and components off without a warning', async () => {
        await run(tree, { type: 'utils', routing: true, skipModule: false, standalone: true });

        expect(forwardedOptions()).toMatchObject({
          routing: false,
          skipModule: true,
          standalone: false
        });
        expect(loggerWarn).not.toHaveBeenCalled();
      });
    });

    describe('testing', () => {
      it('defaults to no routing and no starter component', async () => {
        await run(tree, { type: 'testing' });

        expect(forwardedOptions()).toMatchObject({
          routing: false,
          skipModule: true,
          standalone: false
        });
      });

      it('is tested like any other lib: it gets the default runner, a Vitest config and a `typecheck` target', async () => {
        await run(tree, { type: 'testing' });

        expect(forwardedOptions()).toMatchObject({ unitTestRunner: 'vitest-analog' });
        expect(tree.exists('libs/billing/testing/vitest.config.mts')).toBe(true);
        expect(readProjectConfiguration(tree, 'billing-testing').targets).toHaveProperty(
          'typecheck'
        );
      });

      it('keeps the unit test runner the caller sets', async () => {
        await run(tree, { type: 'testing', unitTestRunner: 'none' } as never);

        expect(forwardedOptions()).toMatchObject({ unitTestRunner: 'none' });
        expect(tree.exists('libs/billing/testing/vitest.config.mts')).toBe(false);
      });
    });
  });

  describe('`tsconfig.lib.json` types', () => {
    it('adds the Vitest globals to a `testing` lib, for the mocks and fixtures in its source', async () => {
      await run(tree, { type: 'testing' });

      expect(
        readJson(tree, 'libs/billing/testing/tsconfig.lib.json').compilerOptions.types
      ).toEqual(['vitest/globals']);
    });

    it.each(['ui', 'utils', 'core', 'feature', 'data-access'] as const)(
      'leaves the types of a `%s` lib alone',
      async type => {
        await run(tree, { type });

        expect(
          readJson(tree, `libs/billing/${type}/tsconfig.lib.json`).compilerOptions.types
        ).toEqual([]);
      }
    );

    it('adds nothing to a `testing` lib without a unit test runner', async () => {
      await run(tree, { type: 'testing', unitTestRunner: 'none' } as never);

      expect(
        readJson(tree, 'libs/billing/testing/tsconfig.lib.json').compilerOptions.types
      ).toEqual([]);
    });
  });

  describe('template files', () => {
    it.each([
      ['core', ['src/lib/.gitkeep']],
      [
        'data-access',
        ['src/lib/features/.gitkeep', 'src/lib/services/.gitkeep', 'src/lib/stores/.gitkeep']
      ],
      ['feature', ['src/lib/pages/.gitkeep']],
      [
        'ui',
        [
          'src/lib/components/.gitkeep',
          'src/lib/directives/.gitkeep',
          'src/lib/forms/.gitkeep',
          'src/lib/pipes/.gitkeep'
        ]
      ],
      ['testing', ['src/lib/.gitkeep']]
    ] as const)('adds the folders of a `%s` lib', async (type, files) => {
      await run(tree, { type });

      for (const file of files) {
        expect(tree.exists(`libs/billing/${type}/${file}`)).toBe(true);
      }
    });

    it('names the `utils` files for the project name without its `utils` suffix', async () => {
      await run(tree, { type: 'utils' });

      expect(tree.exists('libs/billing/utils/src/lib/billing.utils.ts')).toBe(true);
      expect(tree.exists('libs/billing/utils/src/lib/billing.utils.spec.ts')).toBe(true);
    });

    it('includes the group in the `utils` file names', async () => {
      await run(tree, { type: 'utils', group: 'format' });

      expect(tree.exists('libs/billing/format/utils/src/lib/billing-format.utils.ts')).toBe(true);
    });

    it('uses a name the caller sets for the `utils` file names', async () => {
      await run(tree, { type: 'utils', name: 'billing-helpers' });

      expect(tree.exists('libs/billing/utils/src/lib/billing-helpers.utils.ts')).toBe(true);
    });

    it('gives a `utils` library without a unit test runner no spec, but still its file', async () => {
      await run(tree, { type: 'utils', unitTestRunner: 'none' } as never);

      expect(tree.exists('libs/billing/utils/src/lib/billing.utils.ts')).toBe(true);
      expect(tree.exists('libs/billing/utils/src/lib/billing.utils.spec.ts')).toBe(false);
    });

    it('leaves no `undefined` or stray separator in the generated paths', async () => {
      await run(tree, { type: 'utils' });

      const paths = tree.listChanges().map(change => change.path);

      expect(paths.filter(path => /undefined|,/.test(path))).toEqual([]);
    });

    it('exports the `utils` file from the barrel, and the file is a module', async () => {
      await run(tree, { type: 'utils' });

      expect(tree.read('libs/billing/utils/src/index.ts', 'utf-8')).toContain(
        "export * from './lib/billing.utils'"
      );
      expect(tree.read('libs/billing/utils/src/lib/billing.utils.ts', 'utf-8')).toContain('export');
    });

    it('names the `utils` spec after the topic of the file', async () => {
      await run(tree, { type: 'utils', group: 'format' });

      expect(
        tree.read('libs/billing/format/utils/src/lib/billing-format.utils.spec.ts', 'utf-8')
      ).toContain("describe('billingFormat'");
    });
  });

  describe('buildable and publishable', () => {
    it('forwards them for a lib type that may be built', async () => {
      await run(tree, { type: 'ui', buildable: true, publishable: true, importPath: '@x/ui' });

      expect(forwardedOptions()).toMatchObject({ buildable: true, publishable: true });
    });

    it('forces both off for a `testing` lib and warns for each', async () => {
      await run(tree, { type: 'testing', buildable: true, publishable: true });

      expect(forwardedOptions()).toMatchObject({ buildable: false, publishable: false });
      expect(loggerWarn).toHaveBeenCalledTimes(2);
    });

    it('does not warn for a `testing` lib that asks for neither', async () => {
      await run(tree, { type: 'testing' });

      expect(loggerWarn).not.toHaveBeenCalled();
    });
  });

  describe('unit test runner', () => {
    it.each([
      ['a lib that is not built', {}],
      ['a buildable lib', { buildable: true }],
      ['a publishable lib', { publishable: true, importPath: '@cybertecpty/billing-ui' }]
    ])('defaults to `vitest-analog` for %s', async (_description, options) => {
      await run(tree, { type: 'ui', ...options });

      expect(forwardedOptions()).toMatchObject({ unitTestRunner: 'vitest-analog' });
    });

    it('configures Vitest with `vitest.config.mts` in place of `vite.config.mts` for `vitest-analog`', async () => {
      await run(tree, { type: 'ui', unitTestRunner: 'vitest-analog' } as never);

      expect(tree.exists('libs/billing/ui/vitest.config.mts')).toBe(true);
      expect(tree.exists('libs/billing/ui/vite.config.mts')).toBe(false);
    });

    it('configures Vitest for a buildable lib too', async () => {
      await run(tree, { type: 'ui', buildable: true });

      expect(tree.exists('libs/billing/ui/vitest.config.mts')).toBe(true);
      expect(tree.exists('libs/billing/ui/vite.config.mts')).toBe(false);
    });

    it('forwards `vitest-angular` when the caller asks for it, and leaves its scaffold alone', async () => {
      await run(tree, { type: 'ui', buildable: true, unitTestRunner: 'vitest-angular' } as never);

      expect(forwardedOptions()).toMatchObject({ unitTestRunner: 'vitest-angular' });
      expect(tree.exists('libs/billing/ui/vite.config.mts')).toBe(true);
      expect(tree.exists('libs/billing/ui/vitest.config.mts')).toBe(false);
    });

    it('does not configure Vitest for `none`', async () => {
      await run(tree, { type: 'ui', unitTestRunner: 'none' } as never);

      expect(tree.exists('libs/billing/ui/vitest.config.mts')).toBe(false);
    });
  });

  describe('workspace side effects', () => {
    it('removes the root `vitest.config.ts` the upstream generator wrote', async () => {
      await run(tree, { type: 'ui' });

      expect(tree.exists('vitest.config.ts')).toBe(false);
    });

    it('makes the `Route` import of a routed library a type import', async () => {
      await run(tree, { type: 'feature' });

      expect(tree.read('libs/billing/feature/src/lib/lib.routes.ts', 'utf-8')).toContain(
        "import type { Route } from '@angular/router';"
      );
    });

    it('removes the `@vitest/ui` dependency the upstream generator added', async () => {
      await run(tree, { type: 'ui' });

      expect(readJson(tree, 'package.json').devDependencies).not.toHaveProperty('@vitest/ui');
    });

    it('keeps an `@vitest/ui` dependency the workspace already had', async () => {
      updateJson(tree, 'package.json', json => ({
        ...json,
        devDependencies: { ...json.devDependencies, '@vitest/ui': '^5.0.1' }
      }));

      await run(tree, { type: 'ui' });

      expect(readJson(tree, 'package.json').devDependencies).toHaveProperty('@vitest/ui');
    });

    it('removes the explicit `lint` target when `@nx/eslint/plugin` infers it', async () => {
      updateNxJson(tree, {
        ...readNxJson(tree),
        plugins: [{ plugin: '@nx/eslint/plugin', options: { targetName: 'lint' } }]
      });

      await run(tree, { type: 'ui' });

      expect(readProjectConfiguration(tree, 'billing-ui').targets).not.toHaveProperty('lint');
    });

    it('keeps the explicit `lint` target when `@nx/eslint/plugin` is not registered', async () => {
      updateNxJson(tree, { ...readNxJson(tree), plugins: [] });

      await run(tree, { type: 'ui' });

      expect(readProjectConfiguration(tree, 'billing-ui').targets).toHaveProperty('lint');
    });

    it('adds a `typecheck` target when there is a unit test runner', async () => {
      await run(tree, { type: 'ui' });

      expect(readProjectConfiguration(tree, 'billing-ui').targets).toHaveProperty('typecheck');
    });

    it('adds no `typecheck` target for `none`', async () => {
      await run(tree, { type: 'ui', unitTestRunner: 'none' } as never);

      expect(readProjectConfiguration(tree, 'billing-ui').targets).not.toHaveProperty('typecheck');
    });

    it('keeps the `tsconfig.base.json` paths sorted', async () => {
      tree = createWorkspaceTreeFixture({
        tsConfigPaths: { '@cybertecpty/zzz-existing': ['./libs/zzz/existing/src/index.ts'] }
      });

      await run(tree, { type: 'ui' });

      expect(Object.keys(readJson(tree, 'tsconfig.base.json').compilerOptions.paths)).toEqual([
        '@cybertecpty/billing-ui',
        '@cybertecpty/zzz-existing'
      ]);
    });
  });

  describe('formatting', () => {
    it('formats the files once at the end', async () => {
      await run(tree, { type: 'ui' });

      expect(forwardedOptions()).toMatchObject({ skipFormat: true });
      expect(formatFiles).toHaveBeenCalledTimes(1);
    });

    it('does not format when `skipFormat` is set', async () => {
      await run(tree, { type: 'ui', skipFormat: true });

      expect(formatFiles).not.toHaveBeenCalled();
    });
  });
});
