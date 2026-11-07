import type { Tree } from '@nx/devkit';
import {
  joinPathFragments,
  logger,
  offsetFromRoot,
  readProjectConfiguration,
  updateJson
} from '@nx/devkit';

/** Dependencies the upstream Vitest scaffold adds that nothing in the workspace uses. */
const UPSTREAM_VITEST_PACKAGES = ['@nx/vite', 'vite'];
const ROOT_VITEST_CONFIG = 'vitest.config.ts';
const ROOT_PACKAGE_JSON = 'package.json';

type DependencyMaps = Record<
  'dependencies' | 'devDependencies',
  Record<string, string> | undefined
>;

/** Minimal shape of the tsconfig files `configureVitestProject` rewrites. */
interface TsConfigFile {
  compilerOptions?: Record<string, unknown>;
  include?: string[];
  exclude?: string[];
  [key: string]: unknown;
}

/** The Vitest `test.environment` a project's specs run in. */
type VitestEnvironment = 'jsdom' | 'node';

const ROOT_ESLINT_CONFIG = 'eslint.config.mjs';
const VITEST_SPEC_FILES_ARRAY = /(const vitestSpecFiles = \[\n)([\s\S]*?)(\n\];)/;
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
 * - `tsconfig.spec.json` gets Vitest's globals, ESM modules and the `.mts` config import;
 *   `tsconfig.lib.json` excludes the config and specs.
 * - The project's spec glob joins `vitestSpecFiles` in the root `eslint.config.mjs`, so its
 *   specs are linted with the Vitest rules, and its own `eslint.config.mjs` ignores the
 *   Vitest config in `@nx/dependency-checks`.
 *
 * Files the upstream generator did not write are skipped, not created, apart from the config.
 * The mirror image of the migration checklist in `.claude/rules/testing.md`.
 */
export function configureVitestProject(
  tree: Tree,
  projectName: string,
  environment: VitestEnvironment
): void {
  const { root } = readProjectConfiguration(tree, projectName);

  writeVitestConfig(tree, root, projectName, environment);
  deleteJestConfigs(tree, root);
  updateSpecTsConfig(tree, root);
  updateLibTsConfig(tree, root);
  addToVitestSpecFiles(tree, root);
  ignoreVitestConfigInDependencyChecks(tree, root);
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
  const packageJson = readDependencyMaps(tree);

  const result = await run();

  if (!hadRootVitestConfig && tree.exists(ROOT_VITEST_CONFIG)) {
    tree.delete(ROOT_VITEST_CONFIG);
  }

  if (eslintConfig !== null) {
    tree.write(ROOT_ESLINT_CONFIG, eslintConfig);
  }

  if (packageJson) {
    updateJson<DependencyMaps, DependencyMaps>(tree, ROOT_PACKAGE_JSON, json => {
      for (const field of ['dependencies', 'devDependencies'] as const) {
        for (const name of [...UPSTREAM_VITEST_PACKAGES, ...extraPackages]) {
          if (json[field] && !(name in (packageJson[field] ?? {}))) {
            delete json[field][name];
          }
        }
      }

      return json;
    });
  }

  return result;
}

function addToVitestSpecFiles(tree: Tree, root: string): void {
  const source = tree.read(ROOT_ESLINT_CONFIG, 'utf-8');
  const glob = `'${root}/**/*.{spec,test}.ts'`;

  if (!source || source.includes(glob)) {
    return;
  }

  if (!VITEST_SPEC_FILES_ARRAY.test(source)) {
    logger.warn(
      `Could not find \`vitestSpecFiles\` in ${ROOT_ESLINT_CONFIG}; add ${glob} to it by hand so the specs get the Vitest lint rules.`
    );

    return;
  }

  tree.write(
    ROOT_ESLINT_CONFIG,
    source.replace(
      VITEST_SPEC_FILES_ARRAY,
      (_match, open: string, entries: string, close: string) =>
        `${open}${entries},\n  ${glob}${close}`
    )
  );
}

function deleteJestConfigs(tree: Tree, root: string): void {
  for (const file of tree.children(root)) {
    if (file.startsWith('jest.config.')) {
      tree.delete(joinPathFragments(root, file));
    }
  }
}

function ignoreVitestConfigInDependencyChecks(tree: Tree, root: string): void {
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

function readDependencyMaps(tree: Tree): DependencyMaps | null {
  if (!tree.exists(ROOT_PACKAGE_JSON)) {
    return null;
  }

  const { dependencies, devDependencies } = JSON.parse(
    tree.read(ROOT_PACKAGE_JSON, 'utf-8') ?? '{}'
  ) as Partial<DependencyMaps>;

  return { dependencies, devDependencies };
}

function updateLibTsConfig(tree: Tree, root: string): void {
  const path = joinPathFragments(root, 'tsconfig.lib.json');

  if (!tree.exists(path)) {
    return;
  }

  updateJson<TsConfigFile, TsConfigFile>(tree, path, json => ({
    ...json,
    exclude: ['vitest.config.mts', 'src/**/*.spec.ts', 'src/**/*.test.ts']
  }));
}

function updateSpecTsConfig(tree: Tree, root: string): void {
  const path = joinPathFragments(root, 'tsconfig.spec.json');

  if (!tree.exists(path)) {
    return;
  }

  updateJson<TsConfigFile, TsConfigFile>(tree, path, json => ({
    ...json,
    compilerOptions: {
      ...json.compilerOptions,
      module: 'esnext',
      moduleResolution: 'bundler',
      types: ['vitest/globals', 'node'],
      allowImportingTsExtensions: true,
      noEmit: true
    },
    include: ['vitest.config.mts', 'src/**/*.test.ts', 'src/**/*.spec.ts', 'src/**/*.d.ts']
  }));
}

function writeVitestConfig(
  tree: Tree,
  root: string,
  projectName: string,
  environment: VitestEnvironment
): void {
  const baseConfig = `${offsetFromRoot(root)}vitest.base.mts`;

  tree.write(
    joinPathFragments(root, 'vitest.config.mts'),
    `import { defineConfig, mergeConfig } from 'vitest/config';

import { createBaseVitestConfig } from '${baseConfig}';

export default mergeConfig(
  createBaseVitestConfig(import.meta.dirname),
  defineConfig({
    test: {
      name: '${projectName}',
      environment: '${environment}'
    }
  })
);
`
  );
}
