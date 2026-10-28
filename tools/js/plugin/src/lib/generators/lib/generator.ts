import {
  addTsConfigTypes,
  addTypecheckTarget,
  BACKEND_LIB_TYPES,
  formatProjectTags,
  projectDirFromOpts,
  projectNameFromOpts,
  projectTagsFromOptions,
  removeTsConfigTypes,
  sortTsConfigBasePaths
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
 * or `tools/[<group>/]<type>` for `scope:tools`, ADR 0009), and tags from the shared `nx-utils` helpers rather than taking a raw
 * `directory`, then forwards every other option to `@nx/js:library` unchanged.
 *
 * Backend library types (`api`, `services`, `infra`) are rejected: the backend is .NET
 * (ADR 0017), and those libraries are created with `dotnet new`, not this generator.
 *
 * `--scope` is required, and omitting it is a thrown error rather than an inferred
 * default — unlike `domain`/`group`, there's no single sensible fallback across four
 * possible scopes.
 */
export async function libGenerator(
  tree: Tree,
  options: LibGeneratorOptions
): Promise<GeneratorCallback> {
  assertNotBackendType(options.type);
  const scope = resolveScope(options);
  assertDomainMatchesScope(options.domain, scope);
  const projectOptions = { ...options, scope };
  const name = projectNameFromOpts(projectOptions);
  const directory = projectDirFromOpts(projectOptions);
  const tags = formatProjectTags(projectTagsFromOptions(projectOptions));
  const unitTestRunner = options.unitTestRunner ?? 'jest';

  // A `scope:shared` lib's `typecheck` target is what keeps Node globals out of its source
  // (ADR 0004, #164), and `addTypecheckTarget` adds none without a unit-test runner.
  if (scope === 'shared' && unitTestRunner === 'none') {
    throw new Error(
      '`unitTestRunner: none` is not allowed for `scope:shared` — the library needs a `typecheck` target to stay browser-safe.'
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

  const projectTask = await nxJsLibraryGenerator(tree, {
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
    testEnvironment: options.testEnvironment ?? 'node',
    strict: options.strict ?? true,
    minimal: options.minimal ?? false,
    skipFormat: true
  });

  sortTsConfigBasePaths(tree);
  addTypecheckTarget(tree, name, unitTestRunner);

  const { root } = readProjectConfiguration(tree, name);
  const tsConfigLibPath = joinPathFragments(root, 'tsconfig.lib.json');

  // A `type:testing` library's own source (mocks, builders, fixtures) commonly uses
  // Jest globals (`jest.fn()`, `jest.Mock`) outside `*.spec.ts`, so `tsconfig.lib.json`
  // needs `jest` in `compilerOptions.types` too — `@nx/js:library` only adds it to
  // `tsconfig.spec.json`.
  if (options.type === 'testing') {
    addTsConfigTypes(tree, tsConfigLibPath, ['jest']);
  }

  // `@nx/js:library` loads `node` types; a `scope:shared` lib must stay browser-safe (ADR
  // 0004), so its source is type-checked without them and a Node global fails `typecheck`.
  if (scope === 'shared') {
    removeTsConfigTypes(tree, tsConfigLibPath, ['node']);
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(projectTask);
}

/**
 * A `scope:tools` project lives under `tools/` and is domain-exempt (ADR 0009), so an
 * explicit `domain` is rejected rather than silently dropped. Every other scope places
 * the project under `libs/<domain>/...`, which is never domain-exempt.
 */
function assertDomainMatchesScope(
  domain: LibGeneratorOptions['domain'],
  scope: NonNullable<LibGeneratorOptions['scope']>
): void {
  if (scope === 'tools' && domain) {
    throw new Error(
      '`domain` cannot be set for `scope:tools` — tools projects are domain-exempt. Omit `--domain`.'
    );
  }

  if (scope !== 'tools' && !domain) {
    throw new Error('`domain` must be provided for every `scope` except `tools`.');
  }
}

/** Backend libraries are .NET projects (ADR 0017), so the backend `type:` values aren't scaffolded here. */
function assertNotBackendType(type: LibGeneratorOptions['type']): asserts type is JsLibType {
  if (BACKEND_LIB_TYPES.includes(type)) {
    throw new Error(
      `\`type:${type}\` is a backend library type, and backend libraries are .NET projects created with \`dotnet new\`, not this generator. See ADR 0017.`
    );
  }
}

/** Resolves the project's `scope:` tag from `options`; every type requires `--scope` explicitly. */
function resolveScope(options: LibGeneratorOptions): NonNullable<LibGeneratorOptions['scope']> {
  if (!options.scope) {
    throw new Error('`scope` must be provided.');
  }

  return options.scope;
}

export default libGenerator;
