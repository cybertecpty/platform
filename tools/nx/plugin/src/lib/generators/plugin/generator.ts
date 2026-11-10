import {
  addTypecheckTarget,
  assertNotJestRunner,
  configureVitestProject,
  formatProjectTags,
  projectDirFromOpts,
  projectNameFromOpts,
  projectTagsFromOptions,
  sortTsConfigBasePaths,
  withoutUpstreamVitestSideEffects
} from '@cybertecpty/nx-utils';
import type { GeneratorCallback, Tree } from '@nx/devkit';
import {
  formatFiles,
  generateFiles,
  joinPathFragments,
  readProjectConfiguration,
  runTasksInSerial
} from '@nx/devkit';
import { pluginGenerator as nxPluginGenerator } from '@nx/plugin/generators';
import type { NxPluginGeneratorOptions } from './schema';

/**
 * Workspace `nx-plugin` generator — a thin wrapper over `@nx/plugin:plugin`.
 *
 * Fixes the project as `platform:tools` / `type:plugin`, then derives its name,
 * directory (`tools/<group>/plugin`), and tags from the shared ADR-0009
 * helpers rather than taking a raw `directory`. The `buildable` -> `bundler`
 * step of `normalizeProjectOptions` is deliberately skipped: a plugin's build
 * is driven by `compiler` (`tsc` / `swc`), it has no bundler. Every other
 * option is forwarded to `@nx/plugin:plugin` unchanged.
 */
export async function pluginGenerator(
  tree: Tree,
  options: NxPluginGeneratorOptions
): Promise<GeneratorCallback> {
  const projectOptions = { ...options, platform: 'tools' as const, type: 'plugin' as const };
  const name = projectNameFromOpts(projectOptions);
  const directory = projectDirFromOpts(projectOptions);
  const tags = formatProjectTags(projectTagsFromOptions(projectOptions));
  assertNotJestRunner(options.unitTestRunner);
  const unitTestRunner = options.unitTestRunner ?? 'vitest';

  const projectTask = await withoutUpstreamVitestSideEffects(
    tree,
    () =>
      nxPluginGenerator(tree, {
        name,
        directory,
        tags,
        importPath: options.importPath,
        linter: options.linter ?? 'eslint',
        unitTestRunner,
        compiler: options.compiler ?? 'tsc',
        e2eTestRunner: options.e2eTestRunner ?? 'none',
        e2eProjectDirectory: options.e2eProjectDirectory,
        publishable: options.publishable ?? false,
        useProjectJson: options.useProjectJson,
        enableTypedLinting: options.enableTypedLinting ?? false,
        skipTsConfig: options.skipTsConfig ?? false,
        skipLintChecks: options.skipLintChecks ?? false,
        skipFormat: true
      }),
    // The upstream scaffold adds `jsdom` whatever the environment; plugins run in `node`.
    ['jsdom']
  );

  sortTsConfigBasePaths(tree);

  if (unitTestRunner === 'vitest') {
    configureVitestProject(tree, name, 'node');
  }

  addTypecheckTarget(tree, name, unitTestRunner);

  const projectConfig = readProjectConfiguration(tree, name);

  generateFiles(tree, joinPathFragments(__dirname, 'files'), projectConfig.root, {
    tmpl: ''
  });

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(projectTask);
}

export default pluginGenerator;
