import type { NxProjectLibType } from '@cybertecpty/nx-types';
import { addProjectExport, isProjectOfType, projectSrcLibPath } from '@cybertecpty/nx-utils';
import {
  formatFiles,
  generateFiles,
  joinPathFragments,
  names,
  readProjectConfiguration,
  type ProjectConfiguration,
  type Tree
} from '@nx/devkit';
import { startCase } from 'lodash-es';
import type { NormalizedSignalStoreGeneratorOptions, SignalStoreGeneratorOptions } from './schema';

export const SIGNAL_STORE_INVALID_PROJECT_TYPES: NxProjectLibType[] = ['testing', 'types'];

/**
 * Scaffolds an NgRx signal store and its spec in the `lib` folder of a project's source root, under
 * `directory`, and exports the store from the project's barrel unless `export` is false.
 *
 * It does not install `@ngrx/signals`; the workspace has to have it.
 *
 * @throws when `project` is tagged `type:testing` or `type:types`.
 */
export async function signalStoreGenerator(
  tree: Tree,
  rawOptions: SignalStoreGeneratorOptions
): Promise<void> {
  const options = normalizeOpts(rawOptions);
  const projectConfig = readProjectConfiguration(tree, options.project);

  assertValidProjectType(projectConfig);

  const srcLibDir = projectSrcLibPath(projectConfig);
  const targetDir = joinPathFragments(srcLibDir, options.directory);
  const { className, propertyName } = names(options.name);

  const storeClassName = `${className}Store`;
  const fileName = `${options.name}-store`;
  const testProviders = [
    ...(options.providedInRoot ? [] : [storeClassName]),
    ...(options.skipLogger ? [] : ["provideLogger('test')"])
  ];

  assertStoreFilesAbsent(tree, targetDir, fileName);

  generateFiles(tree, joinPathFragments(__dirname, 'files'), targetDir, {
    ...options,
    className,
    fileName,
    propertyName,
    storeClassName,
    testProviders,
    titleName: startCase(options.name),
    tmpl: ''
  });

  if (options.export) {
    addProjectExport(tree, projectConfig, joinPathFragments(targetDir, fileName));
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

export default signalStoreGenerator;

/**
 * Throws when the store or its spec already exists in `targetDir`, so a rerun cannot replace a
 * store the user has edited. `generateFiles` overwrites without warning.
 */
function assertStoreFilesAbsent(tree: Tree, targetDir: string, fileName: string): void {
  const existing = [`${fileName}.ts`, `${fileName}.spec.ts`]
    .map(file => joinPathFragments(targetDir, file))
    .filter(path => tree.exists(path));

  if (existing.length > 0) {
    throw new Error(
      `${existing.join(' and ')} already exists. Delete it first to regenerate the store, ` +
        'or pass a different `name` or `directory`.'
    );
  }
}

function assertValidProjectType(projectConfig: ProjectConfiguration): void {
  const invalidType = SIGNAL_STORE_INVALID_PROJECT_TYPES.find(type =>
    isProjectOfType(projectConfig, type)
  );

  if (invalidType) {
    throw new Error(
      `Invalid project type for Signal Store: "${
        invalidType
      }". Project type cannot be any of: ${SIGNAL_STORE_INVALID_PROJECT_TYPES.join(', ')}`
    );
  }
}

function normalizeOpts(
  options: SignalStoreGeneratorOptions
): NormalizedSignalStoreGeneratorOptions {
  return {
    ...options,
    addEntities: options.addEntities ?? false,
    directory: options.directory || 'stores',
    export: options.export ?? true,
    providedInRoot: options.providedInRoot ?? true,
    skipEvents: options.skipEvents ?? false,
    skipLogger: options.skipLogger ?? false
  };
}
