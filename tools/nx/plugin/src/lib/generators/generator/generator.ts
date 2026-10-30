import { assertValidPathSegment, readProjectPackageJson } from '@cybertecpty/nx-utils';
import type { Tree } from '@nx/devkit';
import { formatFiles, generateFiles, joinPathFragments, names } from '@nx/devkit';
import { generatorGenerator as nxGeneratorGenerator } from '@nx/plugin/generators';
import {
  addPluginExports,
  assertArtifactAbsent,
  assertValidArtifactName,
  readPluginProject,
  removeUpstreamSchemaDeclaration,
  sortPluginCollection,
  sortPluginDependencies
} from '../../utils/plugin-project.utils';
import type { NxGenGeneratorOptions } from './schema';

/** Path, relative to a plugin's root, that holds its generator folders. */
const GENERATORS_DIR = 'src/lib/generators';

/**
 * Workspace `nx-gen` generator — a thin wrapper over `@nx/plugin:generator`.
 *
 * Targets an existing `type:plugin` project by name (not a raw path) and always
 * writes to `src/lib/generators/<directory>/generator.ts`. After the upstream
 * generator runs it aligns the output with the workspace conventions: the
 * ambient `schema.d.ts` is replaced with a type-checked `schema.ts` exporting
 * `<Name>GeneratorOptions` (the `typecheck` target, issue #48), the
 * `libs/${name}` starter is replaced with a minimal one, a README is added, the
 * generator is re-exported from the plugin's `src/index.ts`, and the plugin's
 * `generators.json` collection and `package.json` dependencies are
 * alpha-sorted.
 */
export async function nxGenGenerator(tree: Tree, options: NxGenGeneratorOptions): Promise<void> {
  const { name, project, description, skipLintChecks, skipFormat } = options;
  const directory = options.directory ?? name;
  const unitTestRunner = options.unitTestRunner ?? 'jest';

  assertValidArtifactName(name);
  assertValidPathSegment(directory, 'directory');

  const projectConfig = readPluginProject(tree, project);

  const generatorDir = joinPathFragments(projectConfig.root, GENERATORS_DIR, directory);
  const generatorPath = joinPathFragments(generatorDir, 'generator.ts');

  assertArtifactAbsent(tree, projectConfig.root, {
    kind: 'generator',
    name,
    artifactDir: generatorDir
  });

  await nxGeneratorGenerator(tree, {
    path: generatorPath,
    name,
    description,
    unitTestRunner,
    skipLintChecks: skipLintChecks ?? false,
    skipFormat: true
  });

  const { className, propertyName } = names(name);
  const generatorFnName = `${propertyName}Generator`;

  // The starter writes a `schema.ts` in its place.
  removeUpstreamSchemaDeclaration(tree, generatorDir, 'generator');
  writeStarterFiles(tree, generatorDir, {
    className,
    generatorFnName,
    name,
    packageName: readProjectPackageJson(tree, projectConfig.root)?.name ?? project,
    summary: description ?? `TODO: describe what the \`${name}\` generator scaffolds.`,
    unitTestRunner
  });
  addPluginExports(tree, projectConfig, {
    kind: 'generator',
    directory,
    fnName: generatorFnName,
    optionsType: `${className}GeneratorOptions`
  });
  sortPluginCollection(tree, projectConfig.root, 'generator');
  sortPluginDependencies(tree, projectConfig.root);

  if (!skipFormat) {
    await formatFiles(tree);
  }
}

/**
 * Overwrites the delegated `generator.ts` (and `generator.spec.ts`, when a
 * unit-test runner is configured) with the workspace's minimal starter, adds a
 * type-checked `schema.ts` exporting `<Name>GeneratorOptions` and a `README.md`, and drops
 * `@nx/plugin`'s placeholder `files/` template so the folder starts clean.
 */
function writeStarterFiles(
  tree: Tree,
  generatorDir: string,
  substitutions: {
    className: string;
    generatorFnName: string;
    name: string;
    packageName: string;
    summary: string;
    unitTestRunner: 'jest' | 'none';
  }
): void {
  tree.delete(joinPathFragments(generatorDir, 'files'));
  generateFiles(tree, joinPathFragments(__dirname, 'files'), generatorDir, {
    ...substitutions,
    tmpl: ''
  });

  if (substitutions.unitTestRunner === 'none') {
    tree.delete(joinPathFragments(generatorDir, 'generator.spec.ts'));
  }
}

export default nxGenGenerator;
