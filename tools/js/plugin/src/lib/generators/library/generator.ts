import {
  addTsConfigTypes,
  addTypecheckTarget,
  assertNotJestRunner,
  assertOwningApp,
  assertValidAppOption,
  configureVitestProject,
  forceTestingLibNotBuildable,
  formatProjectTags,
  projectDirFromOpts,
  projectNameFromOpts,
  projectTagsFromOptions,
  removeTsConfigTypes,
  sortTsConfigBasePaths,
  withoutUpstreamVitestSideEffects
} from '@cybertecpty/nx-utils';
import type { GeneratorCallback, Tree } from '@nx/devkit';
import {
  formatFiles,
  joinPathFragments,
  readProjectConfiguration,
  runTasksInSerial
} from '@nx/devkit';
import { libraryGenerator as nxJsLibraryGenerator } from '@nx/js';
import type { JsLibGeneratorOptions } from './schema';

/**
 * Workspace `ts-lib` generator — a thin wrapper over `@nx/js:library`.
 *
 * Derives the project's name, directory (`libs/<domain>[/<subdomain>...]/[<group>/]<type>`,
 * or `tools/[<group>/]<type>` for `platform:tools`, ADR 0009), and tags from the shared `nx-utils` helpers rather than taking a raw
 * `directory`, then forwards every other option to `@nx/js:library` unchanged.
 *
 * With `--app` the lib is owned by that app (ADR 0023): it goes under `apps/<app>` instead of
 * `libs`, and is tagged `app:<app>`. The app must exist, be a `type:app` project and share the
 * lib's platform (or the lib is `platform:shared`).
 *
 * Backend library types (`api`, `services`, `infra`) are rejected: the backend is .NET
 * (ADR 0017), and those libraries are created with `dotnet new`, not this generator.
 *
 * `--platform` is required, and omitting it is a thrown error rather than an inferred
 * default — unlike `domain`/`group`, there's no single sensible fallback across four
 * possible platforms.
 */
export async function jsLibGenerator(
  tree: Tree,
  options: JsLibGeneratorOptions
): Promise<GeneratorCallback> {
  const platform = options.platform;
  assertNotFrontendFrameworkLib(options.type, platform);
  assertDomainMatchesPlatform(options.domain, platform);

  const projectOptions = { ...options, platform };
  assertValidAppOption(projectOptions);
  assertOwningApp(tree, projectOptions);

  const name = projectNameFromOpts(projectOptions);
  const directory = projectDirFromOpts(projectOptions);
  const tags = formatProjectTags(projectTagsFromOptions(projectOptions));

  assertNotJestRunner(options.unitTestRunner);

  const unitTestRunner = options.unitTestRunner ?? 'vitest';
  const testEnvironment = options.testEnvironment ?? 'node';

  // A `platform:shared` lib's `typecheck` target is what keeps Node globals out of its source
  // (ADR 0004, #164), and `addTypecheckTarget` adds none without a unit-test runner.
  if (platform === 'shared' && unitTestRunner === 'none') {
    throw new Error(
      '`unitTestRunner: none` is not allowed for `platform:shared` — the library needs a `typecheck` target to stay browser-safe.'
    );
  }

  const bundler = forceTestingLibNotBuildable({
    name,
    option: 'bundler',
    type: options.type,
    value: options.bundler ?? 'none'
  });

  const projectTask = await withoutUpstreamVitestSideEffects(tree, () =>
    nxJsLibraryGenerator(tree, {
      name,
      directory,
      tags,
      bundler,
      linter: options.linter ?? 'eslint',
      unitTestRunner,
      publishable: options.publishable ?? false,
      importPath: options.importPath,
      useProjectJson: options.useProjectJson,
      enableTypedLinting: options.enableTypedLinting ?? false,
      skipTsConfig: options.skipTsConfig ?? false,
      skipPackageJson: options.skipPackageJson ?? false,
      skipTypeCheck: options.skipTypeCheck ?? false,
      includeBabelRc: options.includeBabelRc,
      testEnvironment,
      strict: options.strict ?? true,
      minimal: options.minimal ?? false,
      skipFormat: true
    })
  );

  sortTsConfigBasePaths(tree);

  if (unitTestRunner === 'vitest') {
    configureVitestProject(tree, name, testEnvironment);
  }

  addTypecheckTarget(tree, name, unitTestRunner);

  const { root } = readProjectConfiguration(tree, name);
  const tsConfigLibPath = joinPathFragments(root, 'tsconfig.lib.json');

  // A `type:testing` library's own source (mocks, builders, fixtures) commonly uses
  // Vitest globals outside `*.spec.ts`, so `tsconfig.lib.json` needs `vitest/globals` in
  // `compilerOptions.types` too — `@nx/js:library` only adds it to `tsconfig.spec.json`.
  if (options.type === 'testing' && unitTestRunner === 'vitest') {
    addTsConfigTypes(tree, tsConfigLibPath, ['vitest/globals']);
  }

  // `@nx/js:library` loads `node` types; a `platform:shared` lib must stay browser-safe (ADR
  // 0004), so its source is type-checked without them and a Node global fails `typecheck`.
  if (platform === 'shared') {
    removeTsConfigTypes(tree, tsConfigLibPath, ['node']);
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(projectTask);
}

/**
 * A `platform:tools` project lives under `tools/` and is domain-exempt (ADR 0009), so an
 * explicit `domain` is rejected rather than silently dropped. Every other platform places
 * the project under `libs/<domain>/...`, which is never domain-exempt.
 */
function assertDomainMatchesPlatform(
  domain: JsLibGeneratorOptions['domain'],
  platform: NonNullable<JsLibGeneratorOptions['platform']>
): void {
  if (platform === 'tools' && domain) {
    throw new Error(
      '`domain` cannot be set for `platform:tools` — tools projects are domain-exempt. Omit `--domain`.'
    );
  }

  if (platform !== 'tools' && !domain) {
    throw new Error('`domain` must be provided for every `platform` except `tools`.');
  }
}

/**
 * A `platform:frontend` `utils` or `testing` library is an Angular library, so it comes from
 * the `angular-plugin` generator rather than this framework-agnostic one.
 */
function assertNotFrontendFrameworkLib(
  type: JsLibGeneratorOptions['type'],
  platform: JsLibGeneratorOptions['platform']
): void {
  if (platform === 'frontend' && (type === 'utils' || type === 'testing')) {
    throw new Error(
      `A \`platform:frontend\` \`${type}\` library is an Angular library — use \`nx g @cybertecpty/angular-plugin:ng-lib\` instead.`
    );
  }
}

export default jsLibGenerator;
