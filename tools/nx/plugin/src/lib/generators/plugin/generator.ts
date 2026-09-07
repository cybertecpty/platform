import { createProjectTags, projectDirFromOpts, projectNameFromOpts } from '@cybertecpty/nx-utils';
import {
  formatFiles,
  generateFiles,
  GeneratorCallback,
  joinPathFragments,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateProjectConfiguration
} from '@nx/devkit';
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
  const unitTestRunner = options.unitTestRunner ?? 'jest';

  const projectTask = await nxPluginGenerator(tree, {
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
  });

  const projectConfig = readProjectConfiguration(tree, name);

  // Re-add the `typecheck` target the removed `@nx/js/typescript` inference
  // plugin used to provide (dropped because Angular can't do `composite` —
  // ADR 0005). The stub inherits its command from `targetDefaults.typecheck`
  // in nx.json; it gives the plugin's `.spec.ts` files a real `tsc --noEmit`
  // that `ts-jest` and `build` (lib sources only) both skip. See issue #48.
  // Skipped without a unit-test runner: `@nx/plugin:plugin` writes no
  // `tsconfig.spec.json` then, so the inherited command would have no project.
  if (unitTestRunner !== 'none') {
    projectConfig.targets = { ...projectConfig.targets, typecheck: {} };
    updateProjectConfiguration(tree, name, projectConfig);
  }

  generateFiles(tree, joinPathFragments(__dirname, 'files'), projectConfig.root, {
    tmpl: ''
  });

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(projectTask);
}

export default pluginGenerator;
