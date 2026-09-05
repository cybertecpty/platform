import { NxProjectOptions, NxProjectType } from '@cybertecpty/nx-types';

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
 * Converts a project domain to a name by validating each `/`-separated
 * segment and joining them with hyphens.
 */
export function projectDomainToName(domain: string): string {
  const segments = domain.split('/');

  for (const segment of segments) {
    assertValidPathSegment(segment, 'domain');
  }

  return segments.join('-');
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
