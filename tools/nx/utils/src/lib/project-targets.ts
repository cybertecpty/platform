import {
  getOutputsForTargetAndConfiguration,
  readNxJson,
  readProjectConfiguration,
  updateProjectConfiguration,
  type ProjectConfiguration,
  type ProjectGraph,
  type TargetConfiguration,
  type Tree
} from '@nx/devkit';

export interface AddProjectTargetOptions {
  /**
   * Replace an existing target of that name even when it runs a different executor. Off by
   * default, so a target the user wrote is never lost without being asked.
   */
  replace?: boolean;
}

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

const DEFAULT_BUILD_TARGET = 'build';

/**
 * The Nx plugin that infers a project's `lint` target from its ESLint config. `nx.json` is checked
 * for it to tell whether `lint` is already provided, and it is never changed.
 */
const ESLINT_INFERENCE_PLUGIN = '@nx/eslint/plugin';

/**
 * The deprecated executor an upstream generator writes as an explicit `lint` target in a project's
 * `project.json`. A target running it is what `removeRedundantLintTarget` deletes.
 */
const ESLINT_LINT_EXECUTOR = '@nx/eslint:lint';

/**
 * Matches a string containing any glob character (`* ? [ ] { } !`). An output that matches, such
 * as `dist/app/**`, selects files by pattern instead of naming one folder, so it can't be used
 * as a deploy folder. A literal folder name containing one of these characters is rejected too.
 */
const GLOB_CHARACTER = /[*?[\]{}!]/;

/**
 * Sets `targetName` on `projectConfig` and returns `projectConfig`. It mutates `projectConfig`
 * rather than copying it.
 *
 * A target of that name that runs the same executor is replaced, so a generator can run again
 * and leave the project unchanged. One that runs a different executor is the user's own, so it
 * throws unless `options.replace` is set.
 *
 * @throws when `projectConfig` has a `targetName` target that runs a different executor and
 * `options.replace` is not set.
 */
export function addProjectTarget(
  projectConfig: ProjectConfiguration,
  targetName: string,
  targetConfig: TargetConfiguration,
  { replace = false }: AddProjectTargetOptions = {}
): ProjectConfiguration {
  const existing = projectConfig.targets?.[targetName]?.executor;

  if (!replace && existing && existing !== targetConfig.executor) {
    throw new Error(
      `Project ${projectConfig.name ?? projectConfig.root} already has a "${targetName}" target that runs ${existing}. Rename or remove it first.`
    );
  }

  const targets = projectConfig.targets ?? {};
  targets[targetName] = targetConfig;
  projectConfig.targets = targets;
  return projectConfig;
}

/**
 * Adds the `typecheck` target stub every generator-created project needs since the
 * `@nx/js/typescript` inference plugin was dropped (Angular can't do `composite` —
 * ADR 0005/0006). The stub inherits its command from `targetDefaults.typecheck` in
 * `nx.json`, which runs `tsc --noEmit` on the project's `tsconfig.lib.json` and then its
 * `tsconfig.spec.json`. That checks the source against the lib config's own `types` (so a
 * lib without `node` types can't use Node globals), and gives `.spec.ts` files a real type
 * check that Vitest and `build` (lib sources only) both skip. See issues #48 and #164.
 *
 * No-ops when there's no unit-test runner: the underlying `@nx/*:library` /
 * `@nx/*:plugin` generator writes no `tsconfig.spec.json` then, so the inherited
 * command would have no project to type-check.
 */
export function addTypecheckTarget(
  tree: Tree,
  projectName: string,
  unitTestRunner: 'vitest' | 'none'
): void {
  if (unitTestRunner === 'none') {
    return;
  }

  const projectConfig = readProjectConfiguration(tree, projectName);
  projectConfig.targets = { ...projectConfig.targets, typecheck: {} };
  updateProjectConfiguration(tree, projectName, projectConfig);
}

/**
 * Removes the explicit `lint` target an upstream generator wrote, which is redundant when `nx.json`
 * registers `@nx/eslint/plugin`: the plugin infers `lint` from the project's ESLint config, and the
 * explicit `@nx/eslint:lint` executor target is deprecated and ignores the plugin's options. A
 * `lint` target that runs a different executor is the user's own and stays, and so does every
 * other target.
 *
 * No-ops when the plugin is not registered: the explicit target is then the only `lint` target.
 */
export function removeRedundantLintTarget(tree: Tree, projectName: string): void {
  const projectConfig = readProjectConfiguration(tree, projectName);
  const { lint, ...otherTargets } = projectConfig.targets ?? {};

  if (lint?.executor === ESLINT_LINT_EXECUTOR && isLintInferred(tree)) {
    updateProjectConfiguration(tree, projectName, { ...projectConfig, targets: otherTargets });
  }
}

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

/** Whether `nx.json` registers the plugin that infers `lint` from each project's ESLint config. */
function isLintInferred(tree: Tree): boolean {
  const plugins = readNxJson(tree)?.plugins ?? [];

  // Nx 23 lets a plugin be a name or an object with a `plugin` property, so compare by name.
  return plugins.some(
    plugin => (typeof plugin === 'string' ? plugin : plugin.plugin) === ESLINT_INFERENCE_PLUGIN
  );
}
