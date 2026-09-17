import { readProjectConfiguration, Tree, updateJson, updateProjectConfiguration } from '@nx/devkit';

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
 * Adds the `typecheck` target stub every generator-created project needs since the
 * `@nx/js/typescript` inference plugin was dropped (Angular can't do `composite` —
 * ADR 0005/0006). The stub inherits its command from `targetDefaults.typecheck` in
 * `nx.json`; it gives a project's `.spec.ts` files a real `tsc --noEmit` that `ts-jest`
 * and `build` (lib sources only) both skip. See issue #48.
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
