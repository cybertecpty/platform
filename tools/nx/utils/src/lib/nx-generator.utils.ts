import { readProjectConfiguration, Tree, updateJson, updateProjectConfiguration } from '@nx/devkit';

/** Minimal shape of a tsconfig file relevant to `addTsConfigTypes`. */
interface TsConfigWithTypes {
  compilerOptions?: {
    types?: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/** Minimal shape of the root tsconfig relevant to `sortTsConfigBasePaths`. */
interface TsConfigWithPaths {
  compilerOptions?: {
    paths?: Record<string, string[]>;
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
 * Adds the `typecheck` target stub every generator-created project needs since the
 * `@nx/js/typescript` inference plugin was dropped (Angular can't do `composite` —
 * ADR 0005/0006). The stub inherits its command from `targetDefaults.typecheck` in
 * `nx.json`, which runs `tsc --noEmit` on the project's `tsconfig.lib.json` and then its
 * `tsconfig.spec.json`. That checks the source against the lib config's own `types` (so a
 * lib without `node` types can't use Node globals), and gives `.spec.ts` files a real type
 * check that `ts-jest` and `build` (lib sources only) both skip. See issues #48 and #164.
 *
 * No-ops when there's no unit-test runner: the underlying `@nx/*:library` /
 * `@nx/*:plugin` generator writes no `tsconfig.spec.json` then, so the inherited
 * command would have no project to type-check.
 */
export function addTypecheckTarget(
  tree: Tree,
  projectName: string,
  unitTestRunner: 'jest' | 'none'
): void {
  if (unitTestRunner === 'none') {
    return;
  }

  const projectConfig = readProjectConfiguration(tree, projectName);
  projectConfig.targets = { ...projectConfig.targets, typecheck: {} };
  updateProjectConfiguration(tree, projectName, projectConfig);
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

    const sortedPaths = Object.keys(paths)
      .sort()
      .reduce<Record<string, string[]>>((sorted, key) => {
        sorted[key] = paths[key];
        return sorted;
      }, {});

    json.compilerOptions = { ...json.compilerOptions, paths: sortedPaths };

    return json;
  });
}
