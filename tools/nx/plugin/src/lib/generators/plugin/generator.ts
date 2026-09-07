import { createProjectTags, projectDirFromOpts, projectNameFromOpts } from '@cybertecpty/nx-utils';
import { formatFiles, GeneratorCallback, runTasksInSerial, Tree } from '@nx/devkit';
import { pluginGenerator as nxPluginGenerator } from '@nx/plugin/generators';
import { NxPluginGeneratorOptions } from './schema';

/**
 * Workspace `nx-plugin` generator — a thin wrapper over `@nx/plugin:plugin`.
 *
 * Fixes the project as `scope:tools` / `type:plugin`, then derives its name,
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
  const projectOptions = { ...options, scope: 'tools' as const, type: 'plugin' as const };
  const name = projectNameFromOpts(projectOptions);
  const directory = projectDirFromOpts(projectOptions);
  const tags = createProjectTags(projectOptions).toString();

  const projectTask = await nxPluginGenerator(tree, {
    name,
    directory,
    tags,
    importPath: options.importPath,
    linter: options.linter ?? 'eslint',
    unitTestRunner: options.unitTestRunner ?? 'jest',
    compiler: options.compiler ?? 'tsc',
    e2eTestRunner: options.e2eTestRunner ?? 'none',
    e2eProjectDirectory: options.e2eProjectDirectory,
    publishable: options.publishable ?? false,
    useProjectJson: options.useProjectJson,
    enableTypedLinting: options.enableTypedLinting ?? false,
    skipTsConfig: options.skipTsConfig ?? false,
    skipLintChecks: options.skipLintChecks ?? false,
    skipFormat: true
  });

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(projectTask);
}

export default pluginGenerator;
