import { addProjectTarget, isProjectOfType } from '@cybertecpty/nx-utils';
import {
  formatFiles,
  readProjectConfiguration,
  updateProjectConfiguration,
  type Tree
} from '@nx/devkit';
import type { SetupSwaGeneratorOptions } from './schema';

/**
 * Wires an app project for Azure Static Web Apps deployment by adding a `deploy` target that runs
 * the `swa-deploy` executor after `build`. An existing `deploy` target is replaced, so running the
 * generator again leaves the project unchanged.
 *
 * @throws when the project is not an app.
 */
export async function setupSwaGenerator(
  tree: Tree,
  options: SetupSwaGeneratorOptions
): Promise<void> {
  const projectConfig = readProjectConfiguration(tree, options.project);

  if (!isProjectOfType(projectConfig, 'app')) {
    throw new Error(`Project ${options.project} is not an application.`);
  }

  addProjectTarget(projectConfig, 'deploy', {
    executor: '@cybertecpty/azure-plugin:swa-deploy',
    dependsOn: ['build'],
    ...(options.outputPath && { options: { outputPath: options.outputPath } })
  });
  updateProjectConfiguration(tree, options.project, projectConfig);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

export default setupSwaGenerator;
