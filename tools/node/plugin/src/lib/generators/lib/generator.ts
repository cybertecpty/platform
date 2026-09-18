import {
  addTypecheckTarget,
  createProjectTags,
  projectDirFromOpts,
  projectNameFromOpts,
  sortTsConfigBasePaths
} from '@cybertecpty/nx-utils';
import { formatFiles, GeneratorCallback, runTasksInSerial, type Tree } from '@nx/devkit';
import { libraryGenerator as nxNodeLibraryGenerator } from '@nx/node';
import type { LibGeneratorOptions } from './schema';

/**
 * Workspace `lib` generator (`node-plugin`) — a thin wrapper over `@nx/node:library`.
 *
 * Fixes the project as `scope:backend` — `type:infra` isn't one of ADR 0004's three
 * scope-polymorphic types, so unlike `js-plugin:lib` there's nothing to ask — then
 * derives its name, directory (`libs/<domain>[/<subdomain>...]/[<group>/]infra`, ADR
 * 0009), and tags from the shared `nx-utils` helpers rather than taking a raw
 * `directory`. Every other option is forwarded to `@nx/node:library` unchanged.
 */
export async function libGenerator(
  tree: Tree,
  options: LibGeneratorOptions
): Promise<GeneratorCallback> {
  const projectOptions = { ...options, scope: 'backend' as const };
  const name = projectNameFromOpts(projectOptions);
  const directory = projectDirFromOpts(projectOptions);
  const tags = createProjectTags(projectOptions).toString();
  const unitTestRunner = options.unitTestRunner ?? 'jest';

  const projectTask = await nxNodeLibraryGenerator(tree, {
    name,
    directory,
    tags,
    linter: options.linter ?? 'eslint',
    unitTestRunner,
    publishable: options.publishable ?? false,
    buildable: options.buildable ?? true,
    compiler: options.compiler ?? 'tsc',
    importPath: options.importPath,
    simpleModuleName: options.simpleModuleName ?? false,
    rootDir: options.rootDir,
    babelJest: options.babelJest ?? false,
    strict: options.strict ?? true,
    enableTypedLinting: options.enableTypedLinting ?? false,
    skipTsConfig: options.skipTsConfig ?? false,
    useProjectJson: options.useProjectJson,
    skipFormat: true
  });

  sortTsConfigBasePaths(tree);
  addTypecheckTarget(tree, name, unitTestRunner);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(projectTask);
}

export default libGenerator;
