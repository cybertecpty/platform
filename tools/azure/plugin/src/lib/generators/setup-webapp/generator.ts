import type { FileArchiveExecutorOptions } from '@cybertecpty/node-plugin';
import { addProjectTarget, isProjectOfType } from '@cybertecpty/nx-utils';
import {
  formatFiles,
  joinPathFragments,
  normalizePath,
  type ProjectConfiguration,
  readProjectConfiguration,
  type TargetConfiguration,
  type Tree,
  updateProjectConfiguration
} from '@nx/devkit';
import { posix } from 'node:path';
import type { WebappDeployExecutorOptions } from '../../executors/webapp-deploy/schema';
import type { NormalizedSetupWebappGeneratorOptions, SetupWebappGeneratorOptions } from './schema';

const PACKAGE_EXECUTOR = '@cybertecpty/node-plugin:file-archive';
const DEPLOY_EXECUTOR = '@cybertecpty/azure-plugin:webapp-deploy';

/**
 * Wires an app project for Azure Web App deployment. It adds a `package` target that zips the
 * build output with the `file-archive` executor after `build`, and a `deploy` target that uploads
 * that zip with the `webapp-deploy` executor after `package`. Running the generator again
 * replaces its own `package` and `deploy` targets, so the project is left unchanged.
 *
 * @throws when the project is not an app, or already has a `package` or `deploy` target that
 * runs a different executor.
 */
export async function setupWebappGenerator(
  tree: Tree,
  options: SetupWebappGeneratorOptions
): Promise<void> {
  const normalizedOpts = normalizeOpts(options);
  const { project, skipFormat, srcPath } = normalizedOpts;

  let projectConfig = readProjectConfiguration(tree, project);

  if (!isProjectOfType(projectConfig, 'app')) {
    throw new Error(`Project ${project} is not an application.`);
  }

  projectConfig = addPackageTarget(projectConfig, srcPath);
  projectConfig = addDeployTarget(projectConfig, normalizedOpts);

  updateProjectConfiguration(tree, project, projectConfig);

  if (!skipFormat) {
    await formatFiles(tree);
  }
}

export default setupWebappGenerator;

function addDeployTarget(
  projectConfig: ProjectConfiguration,
  opts: NormalizedSetupWebappGeneratorOptions
): ProjectConfiguration {
  const { resourceGroup, name, srcPath, subscription } = opts;

  const webappDeployOpts: WebappDeployExecutorOptions = {
    name,
    resourceGroup,
    srcPath,
    subscription
  };

  const deployConfig: TargetConfiguration = {
    executor: DEPLOY_EXECUTOR,
    dependsOn: ['package'],
    options: webappDeployOpts
  };

  return addProjectTarget(projectConfig, 'deploy', deployConfig);
}

function addPackageTarget(
  projectConfig: ProjectConfiguration,
  srcPath: string
): ProjectConfiguration {
  const fileArchiveOpts: FileArchiveExecutorOptions = {
    destination: posix.dirname(srcPath),
    filename: posix.basename(srcPath),
    format: 'zip'
  };
  const packageConfig: TargetConfiguration = {
    executor: PACKAGE_EXECUTOR,
    dependsOn: ['build'],
    outputs: [joinPathFragments('{workspaceRoot}', srcPath)],
    options: fileArchiveOpts
  };

  return addProjectTarget(projectConfig, 'package', packageConfig);
}

function normalizeOpts(opts: SetupWebappGeneratorOptions): NormalizedSetupWebappGeneratorOptions {
  return {
    ...opts,
    name: opts.name || opts.project,
    // `normalizePath` turns a CLI-supplied backslash path into the forward-slash form `posix`
    // and `outputs` expect.
    srcPath: opts.srcPath
      ? normalizePath(opts.srcPath)
      : joinPathFragments('deploy', `${opts.project}.zip`)
  };
}
