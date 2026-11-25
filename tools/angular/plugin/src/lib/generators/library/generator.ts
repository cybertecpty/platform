import {
  addTsConfigTypes,
  addTypecheckTarget,
  forceTestingLibNotBuildable,
  normalizeProjectOptions,
  removeRedundantLintTarget,
  sortTsConfigBasePaths,
  withoutUpstreamVitestSideEffects
} from '@cybertecpty/nx-utils';
import {
  libraryGenerator as nxAngularLibraryGenerator,
  UnitTestRunner
} from '@nx/angular/generators';
import {
  formatFiles,
  generateFiles,
  joinPathFragments,
  logger,
  names,
  readProjectConfiguration,
  type GeneratorCallback,
  type Tree
} from '@nx/devkit';
import { omit } from 'lodash-es';
import type { NgUnitTestRunner } from '../../types/ng-unit-test-runner';
import {
  ensureEntrypointExports,
  replaceAngularPeerDependencies
} from '../../utils/lib-package-json';
import { normalizeRoutesFile, useRoutesInLazyRegistration } from '../../utils/lib-routes';
import { configureAngularVitestProject } from '../../utils/vitest-config';
import type { NgLibGeneratorOptions, NormalizedNgLibGeneratorOptions } from './schema';

/**
 * Workspace `ng-lib` generator: a thin wrapper over `@nx/angular:library`.
 *
 * Fixes the project as `platform:frontend` and derives its name, directory
 * (`libs/<domain>[/<subdomain>...]/[<group>/]<type>`) and tags from the ADR 0009 helpers rather
 * than taking a raw `directory`. Applies the per-type defaults for `routing`, `skipModule` and
 * `standalone`, forces a `testing` library non-buildable, and turns the Vitest scaffold into the
 * ADR 0018 layout. Adds the folder skeleton for the library's type, and the `typecheck` stub, and
 * sets a buildable library's `@angular/*` peer dependencies from what it imports and gives it an
 * entrypoint ng-packagr can build.
 * Every other option is forwarded to `@nx/angular:library` unchanged.
 */
export async function ngLibGenerator(
  tree: Tree,
  rawOptions: NgLibGeneratorOptions
): Promise<GeneratorCallback> {
  const options = normalizeOptions(rawOptions);
  const { name, type, unitTestRunner } = options;

  const buildable = forceTestingLibNotBuildable({
    name,
    option: 'buildable',
    type,
    value: options.buildable
  });
  const publishable = forceTestingLibNotBuildable({
    name,
    option: 'publishable',
    type,
    value: options.publishable
  });

  const nxOptions = omit(options, ['domain', 'group', 'platform', 'type']);

  // `@nx/vitest` adds `@vitest/ui` at its own pinned Vitest range (`~4.1.0`), which the workspace's
  // Vitest 5 is outside of, and nothing here uses it.
  const projectTask = await withoutUpstreamVitestSideEffects(
    tree,
    () =>
      nxAngularLibraryGenerator(tree, { ...nxOptions, buildable, publishable, skipFormat: true }),
    ['@vitest/ui']
  );

  removeRedundantLintTarget(tree, name);

  if (unitTestRunner === UnitTestRunner.VitestAnalog) {
    configureAngularVitestProject(tree, name);
  }

  addTypecheckTarget(tree, name, unitTestRunner === UnitTestRunner.None ? 'none' : 'vitest');
  sortTsConfigBasePaths(tree);

  const projectConfig = readProjectConfiguration(tree, name);

  normalizeRoutesFile(tree, projectConfig.root, name);

  // Nx registers a lazy, non-standalone library by its module. With no module generated the
  // library exports only its routes, so the registration has to name those.
  if (
    options.routing &&
    options.lazy &&
    options.parent &&
    !options.standalone &&
    options.skipModule
  ) {
    useRoutesInLazyRegistration(tree, projectConfig.root, name, options.parent);
  }

  // A `type:testing` library's own source (mocks, fixtures) commonly uses Vitest globals outside
  // `*.spec.ts`, so `tsconfig.lib.json` needs `vitest/globals` in `compilerOptions.types` too.
  // `@nx/angular:library` only adds it to `tsconfig.spec.json`.
  if (type === 'testing' && unitTestRunner !== UnitTestRunner.None) {
    addTsConfigTypes(tree, joinPathFragments(projectConfig.root, 'tsconfig.lib.json'), [
      'vitest/globals'
    ]);
  }

  const filesPath = joinPathFragments(__dirname, 'files', options.type);
  // A utils file is named for its topic, so the `-utils` suffix of the project name is dropped.
  const { fileName, propertyName } = names(options.name.replace(/-utils$/, ''));
  generateFiles(tree, filesPath, projectConfig.root, { fileName, propertyName, tmpl: '' });

  // Without a unit test runner nothing can run or typecheck a spec, so the library gets none.
  const specPath = joinPathFragments(projectConfig.root, 'src/lib', `${fileName}.spec.ts`);

  if (unitTestRunner === UnitTestRunner.None && tree.exists(specPath)) {
    tree.delete(specPath);
  }

  // A buildable or publishable library gets a `package.json` whose peers assume a starter
  // component, so they are set from what the finished library imports.
  replaceAngularPeerDependencies(tree, projectConfig.root);
  ensureEntrypointExports(tree, projectConfig.root);

  if (!rawOptions.skipFormat) {
    await formatFiles(tree);
  }

  return projectTask;
}

export default ngLibGenerator;

function normalizeCoreOptions(
  options: NormalizedNgLibGeneratorOptions
): NormalizedNgLibGeneratorOptions {
  return {
    ...options,
    routing: options.routing ?? false,
    skipModule: options.skipModule ?? true,
    standalone: options.standalone ?? false
  };
}

function normalizeDataAccessOptions(
  options: NormalizedNgLibGeneratorOptions
): NormalizedNgLibGeneratorOptions {
  if (options.routing) {
    logger.warn(
      'Routing is not allowed from data access libraries.  Please define your routing in a feature library.'
    );
  }

  if (options.standalone || options.skipModule === false) {
    logger.warn(
      'Data access libraries should not export any components or modules, so standalone and skipModule options are ignored.'
    );
  }

  return {
    ...options,
    routing: false,
    skipModule: true,
    standalone: false
  };
}

function normalizeFeatureOptions(
  options: NormalizedNgLibGeneratorOptions
): NormalizedNgLibGeneratorOptions {
  return {
    ...options,
    routing: options.routing ?? true,
    skipModule: options.skipModule ?? true,
    standalone: options.standalone ?? false
  };
}

function normalizeOptions(rawOptions: NgLibGeneratorOptions): NormalizedNgLibGeneratorOptions {
  let options: NormalizedNgLibGeneratorOptions = normalizeProjectOptions({
    ...rawOptions,
    platform: 'frontend',
    prefix: rawOptions.prefix ?? 'ct',
    unitTestRunner: normalizeUnitTestRunner(rawOptions)
  });

  if (options.type === 'core') {
    options = normalizeCoreOptions(options);
  } else if (options.type === 'feature') {
    options = normalizeFeatureOptions(options);
  } else if (options.type === 'ui') {
    options = normalizeUIOptions(options);
  } else if (options.type === 'data-access') {
    options = normalizeDataAccessOptions(options);
  } else if (options.type === 'utils') {
    options = normalizeUtilsOptions(options);
  } else if (options.type === 'testing') {
    options = normalizeTestingOptions(options);
  }

  return options;
}

function normalizeTestingOptions(
  options: NormalizedNgLibGeneratorOptions
): NormalizedNgLibGeneratorOptions {
  if (options.routing || options.standalone || options.skipModule === false) {
    logger.warn(
      'Testing libraries should not export any routes, components or modules, so the routing, standalone and skipModule options are ignored.'
    );
  }

  return {
    ...options,
    routing: false,
    skipModule: true,
    standalone: false
  };
}

function normalizeUIOptions(
  options: NormalizedNgLibGeneratorOptions
): NormalizedNgLibGeneratorOptions {
  if (options.routing) {
    logger.warn(
      'Routing is not allowed from UI libraries.  Please define your routing in a feature library.'
    );
  }

  return {
    ...options,
    routing: false,
    skipModule: options.skipModule ?? true,
    standalone: options.standalone ?? false
  };
}

function normalizeUnitTestRunner(rawOptions: NgLibGeneratorOptions): NgUnitTestRunner {
  return rawOptions.unitTestRunner || 'vitest-analog';
}

function normalizeUtilsOptions(
  options: NormalizedNgLibGeneratorOptions
): NormalizedNgLibGeneratorOptions {
  return {
    ...options,
    routing: false,
    skipModule: true,
    standalone: false
  };
}
