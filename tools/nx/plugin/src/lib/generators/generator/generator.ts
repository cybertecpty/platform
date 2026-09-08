import { assertValidPathSegment } from '@cybertecpty/nx-utils';
import {
  formatFiles,
  generateFiles,
  joinPathFragments,
  names,
  readProjectConfiguration,
  Tree
} from '@nx/devkit';
import { generatorGenerator as nxGeneratorGenerator } from '@nx/plugin/generators';
import { NxGenGeneratorOptions } from './schema';

/** Path, relative to a plugin's root, that holds its generator folders. */
const GENERATORS_DIR = 'src/lib/generators';

/**
 * Workspace `nx-gen` generator — a thin wrapper over `@nx/plugin:generator`.
 *
 * Targets an existing `type:plugin` project by name (not a raw path) and always
 * writes to `src/lib/generators/<directory>/generator.ts`. After the upstream
 * generator runs it aligns the output with the workspace conventions: the
 * ambient `schema.d.ts` becomes a type-checked `schema.ts` (conventions §8;
 * the `typecheck` target, issue #48), the `Schema` interface is renamed to
 * `Options`, the `libs/${name}` starter is replaced with a minimal one, and
 * the generator is re-exported from the plugin's `src/index.ts`.
 */
export async function nxGenGenerator(tree: Tree, options: NxGenGeneratorOptions): Promise<void> {
  const { name, project, description, skipLintChecks, skipFormat } = options;
  const directory = options.directory ?? name;
  const unitTestRunner = options.unitTestRunner ?? 'jest';

  assertValidPathSegment(name, 'name');
  assertValidPathSegment(directory, 'directory');

  const projectConfig = readProjectConfiguration(tree, project);

  if (!projectConfig.tags?.includes('type:plugin')) {
    throw new Error(
      `Project "${project}" is not a plugin (missing the \`type:plugin\` tag). ` +
        'Scaffold the plugin with `nx g @cybertecpty/nx-plugin:nx-plugin` first.'
    );
  }

  const generatorDir = joinPathFragments(projectConfig.root, GENERATORS_DIR, directory);
  const generatorPath = joinPathFragments(generatorDir, 'generator.ts');

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

  swapSchemaDeclaration(tree, generatorDir);
  writeStarterFiles(tree, generatorDir, { className, generatorFnName, name, unitTestRunner });
  appendPluginExports(tree, projectConfig.root, projectConfig.sourceRoot, {
    className,
    directory,
    generatorFnName
  });

  if (!skipFormat) {
    await formatFiles(tree);
  }
}

/**
 * Replaces `@nx/plugin`'s ambient `schema.d.ts` with a `schema.ts` the
 * `typecheck` target can see, renaming `<Name>GeneratorSchema` to the
 * workspace's `<Name>GeneratorOptions`.
 */
function swapSchemaDeclaration(tree: Tree, generatorDir: string): void {
  const schemaDtsPath = joinPathFragments(generatorDir, 'schema.d.ts');

  if (!tree.exists(schemaDtsPath)) {
    throw new Error(
      `\`@nx/plugin:generator\` did not emit ${schemaDtsPath}; its output shape has changed and \`nx-gen\` needs updating.`
    );
  }

  const source = tree.read(schemaDtsPath, 'utf-8') ?? '';

  tree.write(
    joinPathFragments(generatorDir, 'schema.ts'),
    source.replace(/GeneratorSchema/g, 'GeneratorOptions')
  );
  tree.delete(schemaDtsPath);
}

/**
 * Overwrites the delegated `generator.ts` (and `generator.spec.ts`, when a
 * unit-test runner is configured) with the workspace's minimal starter, and
 * drops `@nx/plugin`'s placeholder `files/` template so the folder starts clean.
 */
function writeStarterFiles(
  tree: Tree,
  generatorDir: string,
  substitutions: {
    className: string;
    generatorFnName: string;
    name: string;
    unitTestRunner: 'jest' | 'none';
  }
): void {
  tree.delete(joinPathFragments(generatorDir, 'files'));
  generateFiles(tree, joinPathFragments(__dirname, 'files'), generatorDir, substitutions);

  if (substitutions.unitTestRunner === 'none') {
    tree.delete(joinPathFragments(generatorDir, 'generator.spec.ts'));
  }
}

/**
 * Appends the generator's default and options-type re-exports to the plugin's
 * `src/index.ts`, once — re-running for the same generator is a no-op.
 */
function appendPluginExports(
  tree: Tree,
  projectRoot: string,
  sourceRoot: string | undefined,
  parts: { className: string; directory: string; generatorFnName: string }
): void {
  const indexPath = joinPathFragments(
    sourceRoot ?? joinPathFragments(projectRoot, 'src'),
    'index.ts'
  );
  const generatorImport = `./lib/generators/${parts.directory}/generator`;
  const existing = tree.exists(indexPath) ? (tree.read(indexPath, 'utf-8') ?? '') : '';

  if (existing.includes(generatorImport)) {
    return;
  }

  const additions =
    `export { default as ${parts.generatorFnName} } from '${generatorImport}';\n` +
    `export type { ${parts.className}GeneratorOptions } from './lib/generators/${parts.directory}/schema';\n`;

  tree.write(indexPath, existing ? `${existing.trimEnd()}\n${additions}` : additions);
}

export default nxGenGenerator;
