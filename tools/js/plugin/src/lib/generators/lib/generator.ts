import { createProjectTags, projectDirFromOpts, projectNameFromOpts } from '@cybertecpty/nx-utils';
import {
  formatFiles,
  GeneratorCallback,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateProjectConfiguration
} from '@nx/devkit';
import { libraryGenerator as nxJsLibraryGenerator } from '@nx/js';
import { LibGeneratorOptions } from './schema';

/**
 * Workspace `lib` generator — a thin wrapper over `@nx/js:library`.
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

  const projectTask = await nxJsLibraryGenerator(tree, {
    name,
    directory,
    tags,
    bundler: options.bundler ?? 'none',
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

  const projectConfig = readProjectConfiguration(tree, name);

  // Re-add the `typecheck` target the removed `@nx/js/typescript` inference
  // plugin used to provide (dropped because Angular can't do `composite` —
  // ADR 0005). The stub inherits its command from `targetDefaults.typecheck`
  // in nx.json; it gives the library's `.spec.ts` files a real `tsc --noEmit`
  // that `ts-jest` and `build` (lib sources only) both skip. See issue #48.
  // Skipped without a unit-test runner: `@nx/js:library` writes no
  // `tsconfig.spec.json` then, so the inherited command would have no project.
  if (unitTestRunner !== 'none') {
    projectConfig.targets = { ...projectConfig.targets, typecheck: {} };
    updateProjectConfiguration(tree, name, projectConfig);
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(projectTask);
}

export default libGenerator;
