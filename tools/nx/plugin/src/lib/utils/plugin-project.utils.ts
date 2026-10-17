import {
  joinPathFragments,
  readJson,
  readProjectConfiguration,
  updateJson,
  type ProjectConfiguration,
  type Tree
} from '@nx/devkit';

/** The artifact a workspace wrapper scaffolds into a plugin: a generator or an executor. */
export type PluginArtifactKind = 'executor' | 'generator';

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

/**
 * Reads the configuration of `project`, which must be tagged `type:plugin`.
 *
 * @throws when the project is not a plugin, pointing at the `nx-plugin` scaffold.
 */
export function readPluginProject(tree: Tree, project: string): ProjectConfiguration {
  const projectConfig = readProjectConfiguration(tree, project);

  if (!projectConfig.tags?.includes('type:plugin')) {
    throw new Error(
      `Project "${project}" is not a plugin (missing the \`type:plugin\` tag). ` +
        'Scaffold the plugin with `nx g @cybertecpty/nx-plugin:nx-plugin` first.'
    );
  }

  return projectConfig;
}

/** The plugin's npm package name — the prefix of its executors in `project.json` targets. */
export function readPluginPackageName(tree: Tree, projectRoot: string): string | undefined {
  const name = readPluginPackageJson(tree, projectRoot).name;

  return typeof name === 'string' ? name : undefined;
}

/**
 * Deletes the ambient `schema.d.ts` that `@nx/plugin:{kind}` emits, so the wrapper
 * can write a type-checked `schema.ts` in its place.
 *
 * @returns the content of the deleted `schema.d.ts` — `nx-gen` rewrites it into
 *   `schema.ts`; `nx-exec` ignores it and writes `schema.ts` from its own template.
 * @throws when upstream did not emit it — its output shape has changed.
 */
export function takeUpstreamSchemaDeclaration(
  tree: Tree,
  artifactDir: string,
  kind: PluginArtifactKind
): string {
  const schemaDtsPath = joinPathFragments(artifactDir, 'schema.d.ts');

  if (!tree.exists(schemaDtsPath)) {
    throw new Error(
      `\`@nx/plugin:${kind}\` did not emit ${schemaDtsPath}; its output shape has changed and \`${WRAPPER_NAMES[kind]}\` needs updating.`
    );
  }

  const source = tree.read(schemaDtsPath, 'utf-8') ?? '';
  tree.delete(schemaDtsPath);

  return source;
}

/**
 * Re-exports an artifact's default function and options type from the plugin's
 * `src/index.ts`, once — when the index already imports the artifact, it is left
 * untouched.
 */
export function appendPluginExports(
  tree: Tree,
  { root, sourceRoot }: Pick<ProjectConfiguration, 'root' | 'sourceRoot'>,
  { kind, directory, fnName, optionsType }: PluginArtifactExport
): void {
  const indexPath = joinPathFragments(sourceRoot ?? joinPathFragments(root, 'src'), 'index.ts');
  const existing = tree.exists(indexPath) ? (tree.read(indexPath, 'utf-8') ?? '') : '';
  const artifactDir = `./lib/${kind}s/${directory}`;
  const importPath = `${artifactDir}/${kind}`;

  if ([`'${importPath}'`, `"${importPath}"`].some(quoted => existing.includes(quoted))) {
    return;
  }

  const additions =
    `export { default as ${fnName} } from '${importPath}';\n` +
    `export type { ${optionsType} } from '${artifactDir}/schema';\n`;

  tree.write(indexPath, existing ? `${existing.trimEnd()}\n${additions}` : additions);
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
      json.dependencies = sortKeys(json.dependencies);
    }

    return json;
  });
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
  const packageJson = readPluginPackageJson(tree, projectRoot);
  const declared = keys.map(key => packageJson[key]).find(value => typeof value === 'string');
  const collectionPath = joinPathFragments(projectRoot, declared ?? `${kind}s.json`);

  if (!tree.exists(collectionPath)) {
    return;
  }

  updateJson<Record<string, Record<string, unknown> | undefined>>(tree, collectionPath, json => {
    for (const key of keys) {
      const collection = json[key];

      if (collection) {
        json[key] = sortKeys(collection);
      }
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

/** A copy of `record` with its keys in code-unit order, as `Array.prototype.sort` orders them. */
function sortKeys<T>(record: Record<string, T>): Record<string, T> {
  const sorted: Record<string, T> = {};

  for (const key of Object.keys(record).sort()) {
    sorted[key] = record[key];
  }

  return sorted;
}
