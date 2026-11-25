import type { PackageJsonDependencies } from '@cybertecpty/types';
import type { Tree } from '@nx/devkit';
import {
  generateFiles,
  joinPathFragments,
  offsetFromRoot,
  readProjectConfiguration,
  updateJson
} from '@nx/devkit';
import type { TsConfigJson } from 'type-fest';
import { readWorkspaceDependencies } from './workspace';

/** Dependencies the upstream Vitest scaffold adds that nothing in the workspace uses. */
const UPSTREAM_VITEST_PACKAGES = ['@nx/vite', 'vite'];
const ROOT_VITEST_CONFIG = 'vitest.config.ts';
const ROOT_PACKAGE_JSON = 'package.json';

/** The Vitest `test.environment` a project's specs run in. */
type VitestEnvironment = 'jsdom' | 'node';

const ROOT_ESLINT_CONFIG = 'eslint.config.mjs';
const DEPENDENCY_CHECKS_IGNORED_FILES = /(ignoredFiles:\s*\[)([^\]]*)(\])/;
const ESLINT_IGNORED_VITEST_CONFIG = "'{projectRoot}/vitest.config.{js,cjs,mjs,ts,cts,mts}'";

/** Jest is retired as a generated runner (ADR 0018), so it is rejected with a pointer to why. */
export function assertNotJestRunner(unitTestRunner: string | undefined): void {
  if (unitTestRunner === 'jest') {
    throw new Error(
      '`unitTestRunner: jest` is no longer supported — the workspace generates Vitest projects (ADR 0018).'
    );
  }
}

/**
 * Turns the project the upstream `@nx/*` generator just created into a Vitest project the way
 * ADR 0018 lays it out, replacing whatever test-runner scaffold that generator wrote:
 *
 * - `vitest.config.mts` merges the root `vitest.base.mts` with the project's `name` and
 *   `environment` only, so the coverage numbers stay in one place.
 * - Any `jest.config.*` is deleted.
 * - `tsconfig.spec.json` is written with Vitest's globals, ESM modules and the `.mts` config import;
 *   `tsconfig.lib.json` excludes the config and specs.
 * - The project's own `eslint.config.mjs` ignores the Vitest config in `@nx/dependency-checks`.
 *
 * The Vitest config and `tsconfig.spec.json` come from the templates in `files/vitest`, replacing
 * the upstream ones. Other files the upstream generator did not write are skipped, not created.
 * The mirror image of the migration checklist in `.claude/rules/testing.md`.
 */
export function configureVitestProject(
  tree: Tree,
  projectName: string,
  environment: VitestEnvironment
): void {
  const { root } = readProjectConfiguration(tree, projectName);

  deleteJestConfigs(tree, root);
  generateFiles(tree, joinPathFragments(__dirname, 'files', 'vitest'), root, {
    name: projectName,
    environment,
    offset: offsetFromRoot(root),
    tmpl: ''
  });
  updateLibTsConfig(tree, root);
  ignoreVitestConfigInDependencyChecks(tree, root);
}

/**
 * Adds the project's `vitest.config.*` to the `ignoredFiles` of the `@nx/dependency-checks` rule in
 * its `eslint.config.mjs`, so the config's imports (`vitest`, a plugin) are not counted as imports
 * of a buildable library. A no-op when the project's ESLint config has no such rule, or already
 * lists the config.
 */
export function ignoreVitestConfigInDependencyChecks(tree: Tree, root: string): void {
  const path = joinPathFragments(root, 'eslint.config.mjs');
  const source = tree.read(path, 'utf-8');

  if (!source || source.includes(ESLINT_IGNORED_VITEST_CONFIG)) {
    return;
  }

  tree.write(
    path,
    source.replace(
      DEPENDENCY_CHECKS_IGNORED_FILES,
      (_match, open: string, entries: string, close: string) =>
        `${open}${entries.trimEnd()}${entries.trim() ? ',' : ''} ${ESLINT_IGNORED_VITEST_CONFIG}${close}`
    )
  );
}

/**
 * Runs an upstream `@nx/*` generator that scaffolds Vitest and then undoes the workspace-level
 * side effects it leaves behind. None of these is a rule in ADR 0018; each is a cost:
 *
 * - a root `vitest.config.ts` fails typed linting (the root file is outside every tsconfig) and
 *   adds a second entry point that runs every project outside Nx;
 * - `@nx/vite` and `vite` in `package.json` have no consumer once `configureVitestProject`
 *   replaces the upstream config, whose only `@nx/vite` imports are deprecated plugins;
 * - the generator strips the explanatory comments from the root `eslint.config.mjs` when it
 *   rewrites the file.
 *
 * `extraPackages` names more dependencies to drop the same way (`jsdom` for a project that
 * runs in `node`). Anything the workspace already had before the call is left as it was.
 */
export async function withoutUpstreamVitestSideEffects<T>(
  tree: Tree,
  run: () => Promise<T> | T,
  extraPackages: readonly string[] = []
): Promise<T> {
  const hadRootVitestConfig = tree.exists(ROOT_VITEST_CONFIG);
  const eslintConfig = tree.read(ROOT_ESLINT_CONFIG, 'utf-8');
  const packageJson = readWorkspaceDependencies(tree);

  const result = await run();

  if (!hadRootVitestConfig && tree.exists(ROOT_VITEST_CONFIG)) {
    tree.delete(ROOT_VITEST_CONFIG);
  }

  if (eslintConfig !== null) {
    tree.write(ROOT_ESLINT_CONFIG, eslintConfig);
  }

  if (packageJson) {
    updateJson<Required<PackageJsonDependencies>, Required<PackageJsonDependencies>>(
      tree,
      ROOT_PACKAGE_JSON,
      json => {
        for (const field of ['dependencies', 'devDependencies'] as const) {
          for (const name of [...UPSTREAM_VITEST_PACKAGES, ...extraPackages]) {
            if (json[field] && !(name in packageJson[field])) {
              delete json[field][name];
            }
          }
        }

        return json;
      }
    );
  }

  return result;
}

function deleteJestConfigs(tree: Tree, root: string): void {
  for (const file of tree.children(root)) {
    if (file.startsWith('jest.config.')) {
      tree.delete(joinPathFragments(root, file));
    }
  }
}

function updateLibTsConfig(tree: Tree, root: string): void {
  const path = joinPathFragments(root, 'tsconfig.lib.json');

  if (!tree.exists(path)) {
    return;
  }

  updateJson<TsConfigJson>(tree, path, json => ({
    ...json,
    exclude: ['vitest.config.mts', 'src/**/*.spec.ts', 'src/**/*.test.ts']
  }));
}
