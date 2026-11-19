import { ignoreVitestConfigInDependencyChecks } from '@cybertecpty/nx-utils';
import {
  generateFiles,
  joinPathFragments,
  offsetFromRoot,
  readProjectConfiguration,
  type Tree,
  updateJson
} from '@nx/devkit';
import type { TsConfigJson } from 'type-fest';

/**
 * Turns the project `@nx/angular:library` just created with `vitest-analog` into a Vitest project
 * the way ADR 0018 lays it out. Unlike `configureVitestProject` in `@cybertecpty/nx-utils`, the
 * config it writes keeps the Analog plugin and the TestBed setup file the upstream generator
 * scaffolded, because Angular specs do not compile or run without them.
 *
 * - `vitest.config.mts` merges the root `vitest.base.mts` with the project's `name`, the `jsdom`
 *   environment, the `angular()` plugin and `src/test-setup.ts`. It replaces `vite.config.mts`, so
 *   Vitest has one config to find and the library has no `@nx/vite` imports.
 * - `tsconfig.spec.json` allows the `.mts` import of the base config and drops the `vite/client`
 *   type, whose `vite` package is not a dependency of the workspace. It does not set `noEmit`: the
 *   Analog plugin compiles components through this tsconfig, and a program that cannot emit leaves
 *   them unresolved. The `typecheck` target passes `--noEmit` itself. Nx's `include` / `exclude`
 *   lists already name `vitest.config.mts` and the setup file, so nothing else is rewritten.
 * - A buildable library's `eslint.config.mjs` lists `vitest.config.mts` in the ignored files of
 *   `@nx/dependency-checks`, so the config's imports are not counted as the library's own.
 */
export function configureAngularVitestProject(tree: Tree, projectName: string): void {
  const { root } = readProjectConfiguration(tree, projectName);

  tree.delete(joinPathFragments(root, 'vite.config.mts'));
  generateFiles(tree, joinPathFragments(__dirname, 'files'), root, {
    name: projectName,
    offset: offsetFromRoot(root),
    tmpl: ''
  });
  updateSpecTsConfig(tree, root);
  ignoreVitestConfigInDependencyChecks(tree, root);
}

function updateSpecTsConfig(tree: Tree, root: string): void {
  updateJson<TsConfigJson>(tree, joinPathFragments(root, 'tsconfig.spec.json'), json => ({
    ...json,
    compilerOptions: {
      ...json.compilerOptions,
      allowImportingTsExtensions: true,
      types: json.compilerOptions?.types?.filter(type => type !== 'vite/client')
    }
  }));
}
