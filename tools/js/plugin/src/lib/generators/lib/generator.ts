import {
  addTsConfigTypes,
  addTypecheckTarget,
  assertNotJestRunner,
  BACKEND_LIB_TYPES,
  configureVitestProject,
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
  logger,
  readProjectConfiguration,
  runTasksInSerial
} from '@nx/devkit';
import { libraryGenerator as nxJsLibraryGenerator } from '@nx/js';
import type { JsLibType, LibGeneratorOptions } from './schema';

/**
 * Workspace `ts-lib` generator — a thin wrapper over `@nx/js:library`.
 *
 * Derives the project's name, directory (`libs/<domain>[/<subdomain>...]/[<group>/]<type>`,
 * or `tools/[<group>/]<type>` for `platform:tools`, ADR 0009), and tags from the shared `nx-utils` helpers rather than taking a raw
 * `directory`, then forwards every other option to `@nx/js:library` unchanged.
 *
 * Backend library types (`api`, `services`, `infra`) are rejected: the backend is .NET
 * (ADR 0017), and those libraries are created with `dotnet new`, not this generator.
 *
 * `--platform` is required, and omitting it is a thrown error rather than an inferred
 * default — unlike `domain`/`group`, there's no single sensible fallback across four
 * possible platforms.
 */
export async function libGenerator(
  tree: Tree,
  options: LibGeneratorOptions
): Promise<GeneratorCallback> {
  assertNotBackendType(options.type);
  const platform = resolvePlatform(options);
  assertDomainMatchesPlatform(options.domain, platform);
  const projectOptions = { ...options, platform };
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

  // A `type:testing` library is never buildable — the same invariant `nx-utils`'s
  // `normalizeProjectOptions` enforces for the `buildable` flag, restated here because
  // this generator forwards the native `bundler` enum directly instead of going through
  // it. A production library that imported a buildable testing-helpers lib would
  // otherwise pull it in as a real buildable dependency.
  let bundler = options.bundler ?? 'none';
  if (options.type === 'testing' && bundler !== 'none') {
    logger.warn(
      `The "testing" library type cannot be buildable. Setting bundler to "none" for project "${name}".`
    );
    bundler = 'none';
  }

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
  domain: LibGeneratorOptions['domain'],
  platform: NonNullable<LibGeneratorOptions['platform']>
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

/** Backend libraries are .NET projects (ADR 0017), so the backend `type:` values aren't scaffolded here. */
function assertNotBackendType(type: LibGeneratorOptions['type']): asserts type is JsLibType {
  const backendTypes: readonly string[] = BACKEND_LIB_TYPES;

  if (backendTypes.includes(type)) {
    throw new Error(
      `\`type:${type}\` is a backend library type, and backend libraries are .NET projects created with \`dotnet new\`, not this generator. See ADR 0017.`
    );
  }
}

/** Resolves the project's `platform:` tag from `options`; every type requires `--platform` explicitly. */
function resolvePlatform(
  options: LibGeneratorOptions
): NonNullable<LibGeneratorOptions['platform']> {
  if (!options.platform) {
    throw new Error('`platform` must be provided.');
  }

  return options.platform;
}

export default libGenerator;
