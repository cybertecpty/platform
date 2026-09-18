import {
  addTsConfigTypes,
  addTypecheckTarget,
  createProjectTags,
  projectDirFromOpts,
  projectNameFromOpts,
  sortTsConfigBasePaths
} from '@cybertecpty/nx-utils';
import {
  formatFiles,
  GeneratorCallback,
  joinPathFragments,
  logger,
  readProjectConfiguration,
  runTasksInSerial,
  Tree
} from '@nx/devkit';
import { libraryGenerator as nxJsLibraryGenerator } from '@nx/js';
import { LibGeneratorOptions } from './schema';

/**
 * Workspace `ts-lib` generator — a thin wrapper over `@nx/js:library`.
 *
 * Derives the project's name, directory (`libs/<domain>[/<subdomain>...]/[<group>/]<type>`,
 * ADR 0009), and tags from the shared `nx-utils` helpers rather than taking a raw
 * `directory`, then forwards every other option to `@nx/js:library` unchanged.
 */
export async function libGenerator(
  tree: Tree,
  options: LibGeneratorOptions
): Promise<GeneratorCallback> {
  const name = projectNameFromOpts(options);
  const directory = projectDirFromOpts(options);
  const tags = createProjectTags(options).toString();
  const unitTestRunner = options.unitTestRunner ?? 'jest';

  // A `type:testing` library is never buildable — the same invariant `nx-utils`'s
  // `normalizeProjectOptions` enforces for the `buildable` flag, restated here because
  // this generator forwards the native `bundler` enum directly instead of going through
  // it. A production library that imported a buildable testing-helpers lib would
  // otherwise pull it in as a real buildable dependency.
  let bundler = options.bundler ?? 'none';
  if (options.type === 'testing' && bundler !== 'none') {
    logger.warn(
      `The "testing" library type cannot be buildable. Setting bundler to "none" for project "${name}".`
    );
    bundler = 'none';
  }

  const projectTask = await nxJsLibraryGenerator(tree, {
    name,
    directory,
    tags,
    bundler,
    linter: options.linter ?? 'eslint',
    unitTestRunner,
    publishable: options.publishable ?? false,
    importPath: options.importPath,
    useProjectJson: options.useProjectJson,
    enableTypedLinting: options.enableTypedLinting ?? false,
    skipTsConfig: options.skipTsConfig ?? false,
    skipPackageJson: options.skipPackageJson ?? false,
    skipTypeCheck: options.skipTypeCheck ?? false,
    includeBabelRc: options.includeBabelRc,
    testEnvironment: options.testEnvironment ?? 'node',
    strict: options.strict ?? true,
    minimal: options.minimal ?? false,
    skipFormat: true
  });

  sortTsConfigBasePaths(tree);
  addTypecheckTarget(tree, name, unitTestRunner);

  // A `type:testing` library's own source (mocks, builders, fixtures) commonly uses
  // Jest globals (`jest.fn()`, `jest.Mock`) outside `*.spec.ts`, so `tsconfig.lib.json`
  // needs `jest` in `compilerOptions.types` too — `@nx/js:library` only adds it to
  // `tsconfig.spec.json`.
  if (options.type === 'testing') {
    const { root } = readProjectConfiguration(tree, name);
    addTsConfigTypes(tree, joinPathFragments(root, 'tsconfig.lib.json'), ['jest']);
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(projectTask);
}

export default libGenerator;
