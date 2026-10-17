import { assertValidPathSegment } from '@cybertecpty/nx-utils';
import { formatFiles, generateFiles, joinPathFragments, names, Tree, writeJson } from '@nx/devkit';
import { executorGenerator as nxExecutorGenerator } from '@nx/plugin/generators';
import {
  appendPluginExports,
  readPluginPackageName,
  readPluginProject,
  removeUpstreamSchemaDeclaration,
  sortPluginCollection,
  sortPluginDependencies
} from '../../utils/plugin-project.utils';
import { NxExecGeneratorOptions } from './schema';

/** Path, relative to a plugin's root, that holds its executor folders. */
const EXECUTORS_DIR = 'src/lib/executors';

/**
 * Workspace `nx-exec` generator — a thin wrapper over `@nx/plugin:executor`, the
 * executor counterpart of `nx-gen`.
 *
 * Targets an existing `type:plugin` project by name (not a raw path) and always
 * writes to `src/lib/executors/<directory>/executor.ts`. After the upstream
 * generator runs it aligns the output with the workspace conventions: the ambient
 * `schema.d.ts` becomes a type-checked `schema.ts` exporting an `Options` interface,
 * `schema.json` is made strict, the `console.log` starter and its spec are replaced
 * with minimal ones built on `@cybertecpty/nx-testing`, a README is added, the
 * executor is re-exported from the plugin's `src/index.ts`, and the plugin's
 * executors collection and dependencies are alpha-sorted.
 */
export async function nxExecGenerator(tree: Tree, options: NxExecGeneratorOptions): Promise<void> {
  const { name, project, skipLintChecks, skipFormat } = options;
  const directory = options.directory ?? name;
  const unitTestRunner = options.unitTestRunner ?? 'jest';
  // `@nx/plugin:executor`'s own default, so every surface agrees with `executors.json`.
  const description = options.description ?? `${name} executor`;

  assertValidPathSegment(name, 'name');
  assertValidPathSegment(directory, 'directory');

  const projectConfig = readPluginProject(tree, project);
  const executorDir = joinPathFragments(projectConfig.root, EXECUTORS_DIR, directory);

  await nxExecutorGenerator(tree, {
    path: joinPathFragments(executorDir, 'executor.ts'),
    name,
    description,
    unitTestRunner,
    includeHasher: false,
    skipLintChecks: skipLintChecks ?? false,
    skipFormat: true
  });

  const { className, propertyName } = names(name);
  const executorFnName = `${propertyName}Executor`;

  // The starter writes a `schema.ts` in its place.
  removeUpstreamSchemaDeclaration(tree, executorDir, 'executor');
  writeStrictSchemaJson(tree, executorDir, { name, description });
  writeStarterFiles(tree, executorDir, {
    className,
    executorFnName,
    name,
    packageName: readPluginPackageName(tree, projectConfig.root) ?? project,
    // Without `--description` the README gets a TODO, not upstream's bare "<name> executor".
    summary: options.description ?? `TODO: describe what the \`${name}\` executor does.`,
    unitTestRunner
  });

  appendPluginExports(tree, projectConfig, {
    kind: 'executor',
    directory,
    fnName: executorFnName,
    optionsType: `${className}ExecutorOptions`
  });
  sortPluginCollection(tree, projectConfig.root, 'executor');
  sortPluginDependencies(tree, projectConfig.root);

  if (!skipFormat) {
    await formatFiles(tree);
  }
}

/**
 * Overwrites `@nx/plugin`'s `schema.json` with a strict one. Written as JSON rather
 * than a template so the description is escaped correctly.
 */
function writeStrictSchemaJson(
  tree: Tree,
  executorDir: string,
  { name, description }: { name: string; description: string }
): void {
  writeJson(tree, joinPathFragments(executorDir, 'schema.json'), {
    $schema: 'https://json-schema.org/schema',
    version: 2,
    title: `${name} executor`,
    description,
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false
  });
}

/**
 * Overwrites the delegated `executor.ts` (and `executor.spec.ts`, when a unit-test
 * runner is configured) with the workspace's minimal starter, and adds `schema.ts`
 * and `README.md`.
 */
function writeStarterFiles(
  tree: Tree,
  executorDir: string,
  substitutions: {
    className: string;
    executorFnName: string;
    name: string;
    packageName: string;
    summary: string;
    unitTestRunner: 'jest' | 'none';
  }
): void {
  generateFiles(tree, joinPathFragments(__dirname, 'files'), executorDir, {
    ...substitutions,
    tmpl: ''
  });

  if (substitutions.unitTestRunner === 'none') {
    tree.delete(joinPathFragments(executorDir, 'executor.spec.ts'));
  }
}

export default nxExecGenerator;
