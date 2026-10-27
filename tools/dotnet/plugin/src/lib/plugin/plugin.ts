import {
  createNodesFromFiles,
  type CreateNodes,
  type CreateNodesResult,
  type TargetConfiguration
} from '@nx/devkit';
import { posix } from 'node:path';

/**
 * Options for the plugin, set on its entry in the `plugins` list of `nx.json`.
 */
export interface CheckBoundariesPluginOptions {
  /** Name of the inferred target. Defaults to `check-boundaries`. */
  targetName?: string;
}

/**
 * The default name of the inferred target.
 */
export const DEFAULT_CHECK_BOUNDARIES_TARGET_NAME = 'check-boundaries';

/**
 * Matches the project file of every .NET project. The folder holding one is the project's root.
 */
export const DOTNET_PROJECT_FILE_GLOB = '**/*.{csproj,fsproj,vbproj}';

/**
 * The code the check runs, so the cached result is discarded when the rules or the logic change.
 * The matrix and `checkDepConstraints` live in `nx-utils`, which uses the tag helpers in
 * `shared-utils`, and the executor is in this plugin.
 */
const CHECK_CODE_INPUTS = [
  '{workspaceRoot}/tools/dotnet/plugin/src/**/*.ts',
  '{workspaceRoot}/tools/nx/utils/src/**/*.{ts,mts}',
  '{workspaceRoot}/libs/shared/utils/src/**/*.ts'
];

/**
 * Adds the `check-boundaries` target (ADR 0019) to every .NET project, found by its project file.
 * A project's `project.json` does not list the target.
 */
export const createNodes: CreateNodes<CheckBoundariesPluginOptions> = [
  DOTNET_PROJECT_FILE_GLOB,
  (projectFiles, options, context) =>
    createNodesFromFiles(
      (projectFile, fileOptions) => createNodesForProjectFile(projectFile, fileOptions),
      projectFiles,
      options,
      context
    )
];

/**
 * The inferred target for one .NET project.
 *
 * Its inputs are the project's own files and its dependencies', since the check reads the
 * references and tags of both, and the code in {@link CHECK_CODE_INPUTS}.
 */
export function createCheckBoundariesTarget(): TargetConfiguration {
  return {
    executor: '@cybertecpty/dotnet-plugin:check-boundaries',
    cache: true,
    inputs: ['default', '^default', ...CHECK_CODE_INPUTS],
    metadata: {
      technologies: ['dotnet'],
      description:
        "Fails when the project references another .NET project in a way ADR 0004's dependency constraints forbid."
    }
  };
}

/**
 * The projects, keyed by root, that one .NET project file contributes to the graph: the project in
 * the folder holding the file, with the `check-boundaries` target.
 */
export function createNodesForProjectFile(
  projectFile: string,
  options: CheckBoundariesPluginOptions | undefined
): CreateNodesResult {
  const targetName = options?.targetName ?? DEFAULT_CHECK_BOUNDARIES_TARGET_NAME;

  return {
    projects: {
      [posix.dirname(projectFile)]: {
        targets: { [targetName]: createCheckBoundariesTarget() }
      }
    }
  };
}
