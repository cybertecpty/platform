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

  generateFiles(tree, joinPathFragments(__dirname, 'files'), targetDir, {
    ...options,
    className,
    fileName,
    propertyName,
    storeClassName,
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
