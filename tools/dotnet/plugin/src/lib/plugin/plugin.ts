import {
  createNodesFromFiles,
  type CreateNodes,
  type CreateNodesResult,
  type TargetConfiguration
} from '@nx/devkit';
import { existsSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';

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
 * The tag of a tests project.
 */
export const TESTING_TAG = 'type:testing';

/**
 * Where coverlet writes a tests project's report (`CoverletOutput` in `Directory.Build.props`).
 * `@nx/dotnet` infers only `{projectRoot}/TestResults` as an output of `test`, so without this the
 * report is not restored on a cache hit.
 */
export const COVERAGE_OUTPUT = '{workspaceRoot}/coverage/{projectRoot}';

/**
 * The name of the inferred target that checks a tests project's `test` target caches the coverage
 * report.
 */
export const CHECK_COVERAGE_OUTPUT_TARGET_NAME = 'check-coverage-output';

/**
 * The names of the inferred targets that check and fix a .NET project's formatting.
 */
export const FORMAT_CHECK_TARGET_NAME = 'format-check';
export const FORMAT_TARGET_NAME = 'format';

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
 * Adds the `check-boundaries` target (ADR 0019) and the `format-check` and `format` targets to every
 * .NET project, found by its project file.
 * A project's `project.json` does not list the target.
 */
export const createNodes: CreateNodes<CheckBoundariesPluginOptions> = [
  DOTNET_PROJECT_FILE_GLOB,
  (projectFiles, options, context) =>
    createNodesFromFiles(
      (projectFile, fileOptions, fileContext) =>
        createNodesForProjectFile(projectFile, fileOptions, fileContext.workspaceRoot),
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
 * The inferred `check-coverage-output` target of a tests project.
 *
 * The result depends on the resolved outputs of `test`, which the project's own files, `nx.json`
 * (plugin order and target defaults) and the version of `@nx/dotnet` (which infers the outputs
 * this plugin extends) decide, so all of them are inputs.
 */
export function createCheckCoverageOutputTarget(): TargetConfiguration {
  return {
    executor: '@cybertecpty/dotnet-plugin:check-coverage-output',
    cache: true,
    inputs: [
      'default',
      '{workspaceRoot}/nx.json',
      { externalDependencies: ['@nx/dotnet'] },
      '{workspaceRoot}/tools/dotnet/plugin/src/**/*.ts'
    ],
    metadata: {
      technologies: ['dotnet'],
      description: "Fails when the project's test target does not cache the coverage report."
    }
  };
}

/**
 * The inferred `format-check` target of one .NET project: `dotnet format` run on the project's
 * folder, failing when it would change a file. A folder holds one project, so a nested tests
 * project is checked by its own target and not by its parent's.
 *
 * Besides the project's files, the rules (`.editorconfig`) and the SDK (`global.json`,
 * `Directory.Build.props`) decide the result, so a change to one re-runs every project.
 */
export function createFormatCheckTarget(): TargetConfiguration {
  return {
    executor: 'nx:run-commands',
    cache: true,
    inputs: [
      'default',
      '{workspaceRoot}/.editorconfig',
      '{workspaceRoot}/global.json',
      '{workspaceRoot}/Directory.Build.props'
    ],
    options: { command: 'dotnet format {projectRoot} --verify-no-changes' },
    metadata: {
      technologies: ['dotnet'],
      description: 'Fails when `dotnet format` would change a file of the project.'
    }
  };
}

/**
 * The inferred `format` target of one .NET project: `dotnet format` run on the project's folder,
 * rewriting files. Not cached, because the point is its effect on the files.
 */
export function createFormatTarget(): TargetConfiguration {
  return {
    executor: 'nx:run-commands',
    cache: false,
    options: { command: 'dotnet format {projectRoot}' },
    metadata: {
      technologies: ['dotnet'],
      description: "Rewrites the project's files to the formatting `dotnet format` expects."
    }
  };
}

/**
 * The projects, keyed by root, that one .NET project file contributes to the graph: the project in
 * the folder holding the file, marked as a .NET project (`@nx/dotnet` sets the same metadata, but
 * the check must not depend on it being registered) and given the `check-boundaries`, `format-check` and `format` targets. A
 * project tagged `type:testing` in its `project.json` also gets the coverage report as an output of
 * its `test` target, and the `check-coverage-output` target that checks it.
 *
 * A folder holding several project files is one project, because Nx keys projects by root and
 * MSBuild itself refuses to build such a folder without being told which file to use.
 */
export function createNodesForProjectFile(
  projectFile: string,
  options: CheckBoundariesPluginOptions | undefined,
  workspaceRoot: string
): CreateNodesResult {
  const targetName = options?.targetName ?? DEFAULT_CHECK_BOUNDARIES_TARGET_NAME;
  const root = posix.dirname(projectFile);
  const targets: Record<string, TargetConfiguration> = {
    [targetName]: createCheckBoundariesTarget(),
    [FORMAT_CHECK_TARGET_NAME]: createFormatCheckTarget(),
    [FORMAT_TARGET_NAME]: createFormatTarget()
  };

  if (hasTestingTag(workspaceRoot, root)) {
    // `...` keeps the outputs `@nx/dotnet` infers.
    targets['test'] = { outputs: ['...', COVERAGE_OUTPUT] };
    targets[CHECK_COVERAGE_OUTPUT_TARGET_NAME] = createCheckCoverageOutputTarget();
  }

  return {
    projects: {
      [root]: {
        metadata: { technologies: ['dotnet'] },
        targets
      }
    }
  };
}

/**
 * Whether the `project.json` in the project's root tags it `type:testing`. A project without one,
 * or without tags, is not a tests project.
 */
function hasTestingTag(workspaceRoot: string, root: string): boolean {
  const projectJsonPath = join(workspaceRoot, root, 'project.json');
  if (!existsSync(projectJsonPath)) {
    return false;
  }
  const { tags } = JSON.parse(readFileSync(projectJsonPath, 'utf-8')) as { tags?: string[] };
  return tags?.includes(TESTING_TAG) ?? false;
}
