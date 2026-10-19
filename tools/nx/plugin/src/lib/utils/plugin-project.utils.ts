import { isProjectOfType } from '@cybertecpty/nx-utils';
import { orderByKeys } from '@cybertecpty/shared-utils';
import {
  joinPathFragments,
  readJson,
  readProjectConfiguration,
  updateJson,
  type ProjectConfiguration,
  type Tree
} from '@nx/devkit';
import { addGlobal } from '@nx/js';
import { ensureTypescript } from '@nx/js/internal';

/** How the plugin's `src/index.ts` re-exports one artifact. */
export interface PluginArtifactExport {
  kind: PluginArtifactKind;
  /** Folder segment under `src/lib/{kind}s/`. */
  directory: string;
  /** Name the artifact's default export is re-exported under, e.g. `swaDeployExecutor`. */
  fnName: string;
  /** The options interface exported from the artifact's `schema.ts`. */
  optionsType: string;
}

/** The artifact a workspace wrapper scaffolds into a plugin: a generator or an executor. */
export type PluginArtifactKind = 'executor' | 'generator';

/**
 * A well-formed path segment that also starts with a letter, so the identifiers derived from
 * it (`{name}Generator`, `{Name}ExecutorOptions`, …) are valid TypeScript. Mirrored by the
 * `name` `pattern` in the `nx-gen` and `nx-exec` `schema.json` files.
 */
const ARTIFACT_NAME_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** The `package.json` / collection-file keys Nx reads for each artifact kind, in priority order. */
const COLLECTION_KEYS: Record<PluginArtifactKind, readonly [string, string]> = {
  executor: ['executors', 'builders'],
  generator: ['generators', 'schematics']
};

/** The workspace wrapper for each artifact kind, named in errors about upstream drift. */
const WRAPPER_NAMES: Record<PluginArtifactKind, string> = {
  executor: 'nx-exec',
  generator: 'nx-gen'
};

/** The TypeScript module, loaded on first use the way `@nx/*` generators load it. */
let tsModule: ReturnType<typeof ensureTypescript> | undefined;

/**
 * Re-exports an artifact's default function and options type from the plugin's
 * `src/index.ts` with `@nx/js`'s `addGlobal`, creating the index if it is missing.
 * `addGlobal` inserts after the last `import` (at the top of an exports-only barrel);
 * `formatFiles` then sorts the exports. It does not check for duplicates: the wrappers
 * refuse to regenerate an existing artifact (`assertArtifactAbsent`), and a duplicate
 * export would fail `typecheck` anyway.
 */
export function addPluginExports(
  tree: Tree,
  { root, sourceRoot }: Pick<ProjectConfiguration, 'root' | 'sourceRoot'>,
  { kind, directory, fnName, optionsType }: PluginArtifactExport
): void {
  const indexPath = joinPathFragments(sourceRoot ?? joinPathFragments(root, 'src'), 'index.ts');
  const artifactDir = `./lib/${kind}s/${directory}`;

  if (!tree.exists(indexPath)) {
    tree.write(indexPath, '');
  }

  tsModule ??= ensureTypescript();
  let sourceFile = tsModule.createSourceFile(
    indexPath,
    tree.read(indexPath, 'utf-8') ?? '',
    tsModule.ScriptTarget.Latest,
    true
  );

  sourceFile = addGlobal(
    tree,
    sourceFile,
    indexPath,
    `export type { ${optionsType} } from '${artifactDir}/schema';`
  );
  addGlobal(
    tree,
    sourceFile,
    indexPath,
    `export { default as ${fnName} } from '${artifactDir}/${kind}';`
  );
}

/**
 * Throws when the plugin already has an artifact in `artifactDir` or a `name` entry in its
 * collection. Upstream `@nx/plugin` overwrites both without warning, which would silently
 * replace a real implementation with the starter. Call it before delegating.
 */
export function assertArtifactAbsent(
  tree: Tree,
  projectRoot: string,
  { kind, name, artifactDir }: { kind: PluginArtifactKind; name: string; artifactDir: string }
): void {
  if (tree.exists(artifactDir)) {
    throw new Error(
      `The ${kind} folder ${artifactDir} already exists. Delete it first to regenerate it, ` +
        'or pass a different `directory`.'
    );
  }

  const collectionPath = resolvePluginCollectionPath(tree, projectRoot, kind);
  const collection = tree.exists(collectionPath)
    ? readJson<Record<string, Record<string, unknown> | undefined>>(tree, collectionPath)
    : {};

  if (COLLECTION_KEYS[kind].some(key => collection[key]?.[name] !== undefined)) {
    throw new Error(
      `${collectionPath} already has a "${name}" ${kind}. Pick a different \`name\`, ` +
        'or remove the existing entry first.'
    );
  }
}

/**
 * Throws unless `name` can name a generator or executor: lowercase alphanumeric words joined by
 * single hyphens, starting with a letter. A leading digit would pass `assertValidPathSegment`
 * but produce invalid identifiers such as `1passwordSyncExecutor`.
 */
export function assertValidArtifactName(name: string): void {
  if (!ARTIFACT_NAME_PATTERN.test(name)) {
    throw new Error(
      `\`name\` "${name}" must be lowercase alphanumeric words joined by single hyphens, ` +
        'starting with a letter, so the generated TypeScript identifiers are valid.'
    );
  }
}

/** The plugin's npm package name — the prefix of its executors in `project.json` targets. */
export function readPluginPackageName(tree: Tree, projectRoot: string): string | undefined {
  const name = readPluginPackageJson(tree, projectRoot).name;

  return typeof name === 'string' ? name : undefined;
}

/**
 * Reads the configuration of `project`, which must be tagged `type:plugin`.
 *
 * @throws when the project is not a plugin, pointing at the `nx-plugin` scaffold.
 */
export function readPluginProject(tree: Tree, project: string): ProjectConfiguration {
  const projectConfig = readProjectConfiguration(tree, project);

  if (!isProjectOfType(projectConfig, 'plugin')) {
    throw new Error(
      `Project "${project}" is not a plugin (missing the \`type:plugin\` tag). ` +
        'Scaffold the plugin with `nx g @cybertecpty/nx-plugin:nx-plugin` first.'
    );
  }

  return projectConfig;
}

/**
 * Deletes the ambient `schema.d.ts` that `@nx/plugin:{kind}` emits; the wrapper's
 * own template writes a type-checked `schema.ts` in its place.
 *
 * @throws when upstream did not emit it — its output shape has changed.
 */
export function removeUpstreamSchemaDeclaration(
  tree: Tree,
  artifactDir: string,
  kind: PluginArtifactKind
): void {
  const schemaDtsPath = joinPathFragments(artifactDir, 'schema.d.ts');

  if (!tree.exists(schemaDtsPath)) {
    throw new Error(
      `\`@nx/plugin:${kind}\` did not emit ${schemaDtsPath}; its output shape has changed and \`${WRAPPER_NAMES[kind]}\` needs updating.`
    );
  }

  tree.delete(schemaDtsPath);
}

/**
 * Alpha-sorts a plugin's generator or executor collection, so `@nx/plugin`'s
 * append-at-the-end entry lands in a stable position. Resolves the collection
 * file the way Nx does — the `package.json` field (`generators` / `schematics`,
 * `executors` / `builders`), falling back to `{kind}s.json`.
 */
export function sortPluginCollection(
  tree: Tree,
  projectRoot: string,
  kind: PluginArtifactKind
): void {
  const keys = COLLECTION_KEYS[kind];
  const collectionPath = resolvePluginCollectionPath(tree, projectRoot, kind);

  if (!tree.exists(collectionPath)) {
    return;
  }

  updateJson<Record<string, Record<string, unknown> | undefined>>(tree, collectionPath, json => {
    for (const key of keys) {
      const collection = json[key];

      if (collection) {
        json[key] = orderByKeys(collection);
      }
    }

    return json;
  });
}

/**
 * Alpha-sorts the plugin's `package.json` `dependencies`, which `@nx/plugin`'s
 * generators reorder by hoisting `@nx/devkit` to the top. pnpm writes them sorted,
 * so this keeps the delegated run from leaving a reorder-only diff.
 */
export function sortPluginDependencies(tree: Tree, projectRoot: string): void {
  const packageJsonPath = joinPathFragments(projectRoot, 'package.json');

  if (!tree.exists(packageJsonPath)) {
    return;
  }

  updateJson<{ dependencies?: Record<string, string> }>(tree, packageJsonPath, json => {
    if (json.dependencies) {
      json.dependencies = orderByKeys(json.dependencies);
    }

    return json;
  });
}

/** The plugin's `package.json`, or `{}` when it has none. */
function readPluginPackageJson(tree: Tree, projectRoot: string): Record<string, unknown> {
  const packageJsonPath = joinPathFragments(projectRoot, 'package.json');

  return tree.exists(packageJsonPath)
    ? readJson<Record<string, unknown>>(tree, packageJsonPath)
    : {};
}

/**
 * The plugin's generator or executor collection file, resolved the way Nx does: the
 * `package.json` field (`generators` / `schematics`, `executors` / `builders`), falling back
 * to `{kind}s.json`. The file may not exist yet.
 */
function resolvePluginCollectionPath(
  tree: Tree,
  projectRoot: string,
  kind: PluginArtifactKind
): string {
  const packageJson = readPluginPackageJson(tree, projectRoot);
  const declared = COLLECTION_KEYS[kind]
    .map(key => packageJson[key])
    .find((value): value is string => typeof value === 'string');

  return joinPathFragments(projectRoot, declared ?? `${kind}s.json`);
}
