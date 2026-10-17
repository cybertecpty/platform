import { getOutputsForTargetAndConfiguration, type ProjectGraph } from '@nx/devkit';

/** Glob characters: an output like `dist/app/**` is a file pattern, not a folder. */
const GLOB_PATTERN = /[*?[\]{}!]/;

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

  if (outputs.length !== 1 || GLOB_PATTERN.test(outputs[0])) {
    throw new Error(
      `${projectName}:${targetName} must declare exactly one output folder, but resolves to ${JSON.stringify(outputs)}.`
    );
  }

  return outputs[0];
};
