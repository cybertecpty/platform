import {
  NormalizedNxProjectOptions,
  NxProjectBundler,
  NxProjectOptions,
  NxProjectScope,
  NxProjectType
} from '@cybertecpty/nx-types';
import { joinPathFragments, logger } from '@nx/devkit';
import { createProjectTags } from './nx-project-tags.utils';

/**
 * Maps every `NxProjectScope` member to `true`. Its only purpose is to be the
 * source `NX_PROJECT_SCOPES` is derived from — TypeScript requires this object
 * literal to have exactly the members of `NxProjectScope`, so adding, removing,
 * or renaming a scope without updating this map is a compile error instead of
 * a silent runtime gap.
 */
const NX_PROJECT_SCOPE_MAP: Record<NxProjectScope, true> = {
  backend: true,
  frontend: true,
  shared: true,
  tools: true
};

/**
 * Array of recognized Nx project scopes, derived from `NX_PROJECT_SCOPE_MAP` so
 * it can never drift from the `NxProjectScope` union it mirrors.
 */
export const NX_PROJECT_SCOPES: readonly NxProjectScope[] = Object.keys(
  NX_PROJECT_SCOPE_MAP
) as NxProjectScope[];

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

const PATH_SEGMENT_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Throws unless `value` is a single well-formed path segment: lowercase
 * alphanumeric words joined by single hyphens. Rejects empty strings,
 * leading/trailing/doubled hyphens, slashes, and uppercase — the class of
 * malformed input a leading/trailing/doubled `/` in `domain`, or a stray `/`
 * in `group`, would otherwise pass through silently.
 */
function assertValidPathSegment(value: string, optionName: string): void {
  if (!PATH_SEGMENT_PATTERN.test(value)) {
    throw new Error(
      `\`${optionName}\` segment "${value}" must be lowercase alphanumeric words joined by single hyphens.`
    );
  }
}

/**
 * Splits a domain into its `/`-separated segments, validating each one.
 */
function domainToSegments(domain: string): string[] {
  const segments = domain.split('/');

  for (const segment of segments) {
    assertValidPathSegment(segment, 'domain');
  }

  return segments;
}

/**
 * Determines the top-level directory a project's source lives under: `apps`
 * for `type: 'app'` (ADR 0010), `tools` for `scope: 'tools'` projects, and
 * `libs` for everything else (ADR 0009).
 */
export function determineTopLevelProjectDir(options: NxProjectOptions): string {
  if (options.type === 'app') {
    return 'apps';
  }

  if (options.scope === 'tools') {
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
    tags: createProjectTags(options).toString()
  };
}

/**
 * Derives the directory a project's source lives in from `domain`/`group`/
 * `type` per ADR 0009 (`libs/<domain>[/<subdomain>...]/[<group>/]<type>` or
 * `tools/[<group>/]<type>`), or `apps/<name>` for app projects per ADR 0010.
 *
 * Mirrors `projectNameFromOpts`: the same options yield a directory and a
 * name that agree, and malformed `domain` / `group` input is rejected the
 * same way by both.
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
    dir = joinPathFragments(dir, ...domainToSegments(domain));
  }

  if (group) {
    assertValidPathSegment(group, 'group');
    dir = joinPathFragments(dir, group);
  }

  return joinPathFragments(dir, type);
}

/**
 * Converts a project domain to a name by validating each `/`-separated
 * segment and joining them with hyphens.
 */
export function projectDomainToName(domain: string): string {
  return domainToSegments(domain).join('-');
}

/**
 * Derives a project name from `domain`/`group`/`type` per ADR 0009's naming
 * formula (`<domain>[-<subdomain>...][-<group>]-<type>`), or returns `name`
 * verbatim when supplied as an override.
 *
 * `app` projects are a special case: their name consists exclusively of
 * `name`, so `domain`/`group` are ignored for naming purposes and `name` is
 * required.
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

  if (domain) {
    name = projectDomainToName(domain);
  }

  if (group) {
    assertValidPathSegment(group, 'group');
    name = name ? `${name}-${group}` : group;
  }

  return `${name}-${type}`;
}

/**
 * Removes the project type suffix from the provided project name.
 */
export function stripProjectTypeFromName(projectName: string): string {
  const suffixPattern = new RegExp(`-(${NX_PROJECT_TYPES.join('|')})$`, 'g');

  return projectName.replace(suffixPattern, '');
}
