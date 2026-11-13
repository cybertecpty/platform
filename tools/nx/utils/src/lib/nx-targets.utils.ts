import { getOutputsForTargetAndConfiguration, type ProjectGraph } from '@nx/devkit';

/**
 * Matches a string containing any glob character (`* ? [ ] { } !`). An output that matches, such
 * as `dist/app/**`, selects files by pattern instead of naming one folder, so it can't be used
 * as a deploy folder. A literal folder name containing one of these characters is rejected too.
 */
const GLOB_CHARACTER = /[*?[\]{}!]/;

/**
 * Resolve the single output folder a project's target declares, using the target's
 * `defaultConfiguration` to fill in placeholders such as `{options.outputPath}`.
 *
 * Throws when the target is missing, declares no outputs, or resolves to several
 * outputs or a glob. A target without `outputs` is rejected before Nx is asked:
 * Nx would otherwise guess several conventional folders for a `build` target.
 *
 * @returns The output folder, relative to the workspace root.
 */
export const resolveTargetOutputFolder = (
  projectGraph: ProjectGraph,
  projectName: string,
  targetName: string
): string => {
  const node = projectGraph.nodes[projectName];

  if (!node) {
    throw new Error(`${projectName} is not in the project graph.`);
  }

  const targetConfiguration = node.data.targets?.[targetName];

  if (!targetConfiguration) {
    throw new Error(`${projectName} has no "${targetName}" target.`);
  }

  if (!targetConfiguration.outputs?.length) {
    throw new Error(
      `${projectName}:${targetName} declares no outputs, so its output folder is unknown.`
    );
  }

  const outputs = getOutputsForTargetAndConfiguration(
    {
      project: projectName,
      target: targetName,
      configuration: targetConfiguration.defaultConfiguration
    },
    {},
    node
  );

  if (outputs.length !== 1 || GLOB_CHARACTER.test(outputs[0])) {
    throw new Error(
      `${projectName}:${targetName} must declare exactly one output folder, but resolves to ${JSON.stringify(outputs)}.`
    );
  }

  return outputs[0];
};

const DEFAULT_BUILD_TARGET = 'build';

export interface ResolveOutputFolderOptions {
  projectGraph: ProjectGraph;
  projectName: string;
  /** The folder an executor option names explicitly. When set, the build target is not read. */
  explicitFolder?: string;
  /** The target whose declared output is used without `explicitFolder`. Defaults to `build`. */
  buildTarget?: string;
  /** Appended to the resolution error, naming the option that avoids the lookup. */
  hint: string;
}

export type ResolveOutputFolderResult = { folder: string } | { error: string };

/**
 * Resolve the folder an executor works on: `explicitFolder` when set, else the single
 * output the build target declares. Returns the failure as `{ error }` rather than
 * throwing, with `hint` appended, so an executor can log it and fail the task.
 */
export const resolveOutputFolder = ({
  projectGraph,
  projectName,
  explicitFolder,
  buildTarget = DEFAULT_BUILD_TARGET,
  hint
}: ResolveOutputFolderOptions): ResolveOutputFolderResult => {
  if (explicitFolder) {
    return { folder: explicitFolder };
  }

  try {
    return { folder: resolveTargetOutputFolder(projectGraph, projectName, buildTarget) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return { error: `${message} ${hint}` };
  }
};
