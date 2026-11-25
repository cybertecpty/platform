import { orderByKeys } from '@cybertecpty/utils';
import { readJson, type Tree, updateJson } from '@nx/devkit';

/** Minimal shape of the root tsconfig relevant to `sortTsConfigBasePaths`. */
interface TsConfigWithPaths {
  compilerOptions?: {
    paths?: Record<string, string[]>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/** Minimal shape of a tsconfig file relevant to `addTsConfigTypes`. */
interface TsConfigWithTypes {
  compilerOptions?: {
    types?: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Merges `types` into a tsconfig file's `compilerOptions.types` array, deduping and
 * sorting alphabetically for a deterministic result regardless of what the underlying
 * `@nx/*:library` generator already wrote there. Creates `compilerOptions` if the file
 * doesn't have one yet.
 */
export function addTsConfigTypes(tree: Tree, tsConfigPath: string, types: string[]): void {
  updateJson<TsConfigWithTypes, TsConfigWithTypes>(tree, tsConfigPath, json => {
    const existingTypes = json.compilerOptions?.types ?? [];
    const mergedTypes = Array.from(new Set([...existingTypes, ...types])).sort();

    json.compilerOptions = { ...json.compilerOptions, types: mergedTypes };

    return json;
  });
}

/**
 * Finds the `tsconfig.base.json` path alias of the project at `projectRoot`, which is how other
 * projects import it: the alias whose target is `./<projectRoot>/<entryPoint>`. `undefined` when no
 * alias points there, or the file has no `paths` map.
 */
export function findProjectImportPath(
  tree: Tree,
  projectRoot: string,
  entryPoint = 'src/index.ts',
  tsConfigBasePath = 'tsconfig.base.json'
): string | undefined {
  const { compilerOptions } = readJson<TsConfigWithPaths>(tree, tsConfigBasePath);
  const target = `./${projectRoot}/${entryPoint}`;

  return Object.entries(compilerOptions?.paths ?? {}).find(([, targets]) =>
    targets.includes(target)
  )?.[0];
}

/**
 * Removes `types` from a tsconfig file's `compilerOptions.types`, keeping the rest in order.
 * Always leaves an explicit array, even an empty one: a tsconfig with no `types` loads every
 * visible `@types` package, which would bring back whatever was removed.
 */
export function removeTsConfigTypes(tree: Tree, tsConfigPath: string, types: string[]): void {
  updateJson<TsConfigWithTypes, TsConfigWithTypes>(tree, tsConfigPath, json => {
    const keptTypes = (json.compilerOptions?.types ?? []).filter(type => !types.includes(type));

    json.compilerOptions = { ...json.compilerOptions, types: keptTypes };

    return json;
  });
}

/**
 * Re-sorts the root tsconfig's `compilerOptions.paths` map alphabetically by key.
 * The underlying `@nx/*:library` / `@nx/*:plugin` generators append a new project's
 * path entry at the end rather than inserting it in order, so every wrapper generator
 * that adds a project should call this afterward to keep the map scannable. A no-op
 * when the file has no `paths` map yet.
 */
export function sortTsConfigBasePaths(tree: Tree, tsConfigBasePath = 'tsconfig.base.json'): void {
  updateJson<TsConfigWithPaths, TsConfigWithPaths>(tree, tsConfigBasePath, json => {
    const paths = json.compilerOptions?.paths;

    if (!paths) {
      return json;
    }

    json.compilerOptions = { ...json.compilerOptions, paths: orderByKeys(paths) };

    return json;
  });
}
