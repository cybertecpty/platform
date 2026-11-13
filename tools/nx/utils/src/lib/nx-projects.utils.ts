import type {
  BackendLibType,
  NormalizedNxProjectOptions,
  NxProjectBundler,
  NxProjectOptions,
  NxProjectPlatform,
  NxProjectType
} from '@cybertecpty/nx-types';
import {
  joinPathFragments,
  logger,
  readJson,
  type ProjectConfiguration,
  type ProjectGraph,
  type TargetConfiguration,
  type Tree
} from '@nx/devkit';
import type { PackageJson } from 'type-fest';
import { domainPathToName, splitDomainPath } from './nx-domain.utils';
import { assertValidPathSegment } from './nx-path-segment.utils';
import { formatProjectTags, projectTagsFromOptions } from './nx-project-tags.utils';

/**
 * Maps every `NxProjectPlatform` member to `true`. Its only purpose is to be the
 * source `NX_PROJECT_PLATFORMS` is derived from — TypeScript requires this object
 * literal to have exactly the members of `NxProjectPlatform`, so adding, removing,
 * or renaming a platform without updating this map is a compile error instead of
 * a silent runtime gap.
 */
const NX_PROJECT_PLATFORM_MAP: Record<NxProjectPlatform, true> = {
  backend: true,
  frontend: true,
  shared: true,
  tools: true
};

/**
 * Array of recognized Nx project platforms, derived from `NX_PROJECT_PLATFORM_MAP` so
 * it can never drift from the `NxProjectPlatform` union it mirrors.
 */
export const NX_PROJECT_PLATFORMS: readonly NxProjectPlatform[] = Object.keys(
  NX_PROJECT_PLATFORM_MAP
) as NxProjectPlatform[];

/**
 * Maps every `NxProjectType` member to `true`. Its only purpose is to be the
 * source `NX_PROJECT_TYPES` is derived from — TypeScript requires this object
 * literal to have exactly the members of `NxProjectType`, so adding, removing,
 * or renaming a type without updating this map is a compile error instead of
 * a silent runtime gap.
 */
const NX_PROJECT_TYPE_MAP: Record<NxProjectType, true> = {
  api: true,
  app: true,
  core: true,
  'data-access': true,
  feature: true,
  infra: true,
  models: true,
  plugin: true,
  services: true,
  testing: true,
  types: true,
  ui: true,
  utils: true
};

/**
 * Array of recognized Nx project types, derived from `NX_PROJECT_TYPE_MAP` so
 * it can never drift from the `NxProjectType` union it mirrors.
 */
export const NX_PROJECT_TYPES: readonly NxProjectType[] = Object.keys(
  NX_PROJECT_TYPE_MAP
) as NxProjectType[];

/**
 * The backend `type:` values. The backend is .NET (ADR 0017), so these libraries are
 * .NET projects created with `dotnet new`, not scaffolded by the TypeScript generators.
 */
export const BACKEND_LIB_TYPES: readonly BackendLibType[] = ['api', 'infra', 'services'];

export interface AddProjectTargetOptions {
  /**
   * Replace an existing target of that name even when it runs a different executor. Off by
   * default, so a target the user wrote is never lost without being asked.
   */
  replace?: boolean;
}

/**
 * Sets `targetName` on `projectConfig` and returns `projectConfig`. It mutates `projectConfig`
 * rather than copying it.
 *
 * A target of that name that runs the same executor is replaced, so a generator can run again
 * and leave the project unchanged. One that runs a different executor is the user's own, so it
 * throws unless `options.replace` is set.
 *
 * @throws when `projectConfig` has a `targetName` target that runs a different executor and
 * `options.replace` is not set.
 */
export function addProjectTarget(
  projectConfig: ProjectConfiguration,
  targetName: string,
  targetConfig: TargetConfiguration,
  { replace = false }: AddProjectTargetOptions = {}
): ProjectConfiguration {
  const existing = projectConfig.targets?.[targetName]?.executor;

  if (!replace && existing && existing !== targetConfig.executor) {
    throw new Error(
      `Project ${projectConfig.name ?? projectConfig.root} already has a "${targetName}" target that runs ${existing}. Rename or remove it first.`
    );
  }

  const targets = projectConfig.targets ?? {};
  targets[targetName] = targetConfig;
  projectConfig.targets = targets;
  return projectConfig;
}

/**
 * Lists the workspace projects `project` depends on, directly or transitively, in the order the
 * walk finds them. External (npm) dependencies are not projects in the graph and are left out, and
 * a dependency cycle does not repeat a project or include `project` itself.
 */
export function collectProjectDependencies(graph: ProjectGraph, project: string): string[] {
  const seen = new Set<string>([project]);
  const queue = [project];

  for (const current of queue) {
    for (const { target } of graph.dependencies[current] ?? []) {
      if (graph.nodes[target] && !seen.has(target)) {
        seen.add(target);
        queue.push(target);
      }
    }
  }

  seen.delete(project);

  return [...seen];
}

/**
 * Determines the top-level directory a project's source lives under: `apps`
 * for `type: 'app'` (ADR 0010), `tools` for `platform: 'tools'` projects, and
 * `libs` for everything else (ADR 0009).
 */
export function determineTopLevelProjectDir(options: NxProjectOptions): string {
  if (options.type === 'app') {
    return 'apps';
  }

  if (options.platform === 'tools') {
    return 'tools';
  }

  return 'libs';
}

/**
 * Normalizes raw project options into the form the generators consume: derives
 * `name`, `directory`, and the `tags` string, and translates the ergonomic
 * `buildable` flag into a concrete `bundler` (`true` → `tsc`, omitted/`false` →
 * `none`). The deprecated `buildable` key is dropped from the result.
 *
 * The `testing` library type is always non-buildable: a production library that
 * imports it would otherwise pull it in as a buildable dependency. A `testing`
 * project that explicitly requests `buildable: true` is downgraded with a warning.
 */
export function normalizeProjectOptions<T extends NxProjectOptions>(
  options: T
): Omit<T, 'buildable'> & NormalizedNxProjectOptions {
  const { buildable: requestedBuildable, ...rest } = options;
  const name = projectNameFromOpts(options);
  const directory = projectDirFromOpts(options);

  let bundler: NxProjectBundler = requestedBuildable ? 'tsc' : 'none';

  if (options.type === 'testing' && requestedBuildable) {
    logger.warn(
      `The "testing" library type cannot be buildable. Setting bundler to "none" for project "${name}".`
    );
    bundler = 'none';
  }

  return {
    ...rest,
    bundler,
    directory,
    name,
    tags: formatProjectTags(projectTagsFromOptions(options))
  };
}

/**
 * Derives the directory a project's source lives in from `domain`/`group`/
 * `type` per ADR 0009 (`libs/<domain>[/<subdomain>...]/[<group>/]<type>` or
 * `tools/[<group>/]<type>`), or `apps/<name>` for app projects per ADR 0010.
 *
 * Mirrors `projectNameFromOpts` for malformed `domain`/`group` input — both
 * reject it the same way. Placement and naming otherwise agree, with one
 * deliberate exception: a `shared`-domain project still lives under
 * `libs/shared/...` here even though `projectNameFromOpts` drops `shared`
 * from its *name* (ADR 0009 amendments, 2026-09-19 and 2026-11-05).
 */
export function projectDirFromOpts(opts: NxProjectOptions): string {
  const { domain, group, name, type } = opts;

  const topLevelDir = determineTopLevelProjectDir(opts);

  if (type === 'app') {
    if (!name) {
      throw new Error('`name` must be provided to derive a project directory for app projects.');
    }

    return joinPathFragments(topLevelDir, name);
  }

  if (!domain && !group && !name) {
    throw new Error(
      'At least one of `domain`, `group`, or `name` must be provided to derive a project directory.'
    );
  }

  let dir = topLevelDir;

  if (domain) {
    dir = joinPathFragments(dir, ...splitDomainPath(domain));
  }

  if (group) {
    assertValidPathSegment(group, 'group');
    dir = joinPathFragments(dir, group);
  }

  return joinPathFragments(dir, type);
}

/**
 * Derives a project name from `domain`/`group`/`type` per ADR 0009's naming
 * formula (`<domain>[-<subdomain>...][-<group>]-<type>`), or returns `name`
 * verbatim when supplied as an override.
 *
 * `app` projects are a special case: their name consists exclusively of
 * `name`, so `domain`/`group` are ignored for naming purposes and `name` is
 * required.
 *
 * The literal `shared` domain is a second special case (ADR 0009 amendments,
 * 2026-09-19 and 2026-11-05): `shared` is always dropped from the *name* (only
 * the name — `projectDirFromOpts` still places it under `libs/shared/...`),
 * with or without a `group` (`fs-utils`, not `shared-fs-utils`; `utils`, not
 * `shared-utils`).
 */
export function projectNameFromOpts(opts: NxProjectOptions): string {
  const { domain, group, name: customName, type } = opts;

  if (type === 'app') {
    if (!customName) {
      throw new Error('`name` must be provided to derive a project name for app projects.');
    }

    return customName;
  }

  if (!domain && !group && !customName) {
    throw new Error(
      'At least one of `domain`, `group`, or `name` must be provided to derive a project name.'
    );
  }

  if (customName) {
    return customName;
  }

  let name = '';

  if (domain && domain !== 'shared') {
    name = domainPathToName(domain);
  }

  if (group) {
    assertValidPathSegment(group, 'group');
    name = name ? `${name}-${group}` : group;
  }

  return name ? `${name}-${type}` : type;
}

/**
 * Reads the `package.json` in `projectRoot` and returns its contents as a `PackageJson`
 * object, or `undefined` when the project has none.
 *
 * @throws when the file exists but is not valid JSON.
 */
export function readProjectPackageJson(tree: Tree, projectRoot: string): PackageJson | undefined {
  const packageJsonPath = joinPathFragments(projectRoot, 'package.json');

  return tree.exists(packageJsonPath) ? readJson<PackageJson>(tree, packageJsonPath) : undefined;
}

/**
 * Removes the project type suffix from the provided project name.
 */
export function stripProjectTypeFromName(projectName: string): string {
  const suffixPattern = new RegExp(`-(${NX_PROJECT_TYPES.join('|')})$`, 'g');

  return projectName.replace(suffixPattern, '');
}
