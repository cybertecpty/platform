import { NxProjectOptions } from '@cybertecpty/nx-types';
import { assertValidPathSegment } from './nx-path-segment.utils';

/**
 * Converts a domain path to a name by validating each `/`-separated
 * segment and joining them with hyphens. Also the form a `domain` tag takes
 * for a subdomain-bearing project (ADR 0009: `domain:<domain>-<subdomain>`).
 */
export function domainPathToName(path: string): string {
  return splitDomainPath(path).join('-');
}

/**
 * Normalizes the domain path for a project based on its options.
 * - If the project is a tool, it should not have a domain.
 * - If the project has a domain, return it.
 * - If the project is not a tool and a domain isn't defined,
 *   default to 'shared' for non-app projects.
 * - If the project is an app and a domain isn't defined, return undefined.
 * @param options The project options to normalize the domain path for.
 * @returns The normalized domain path or undefined if not applicable.
 */
export function normalizeDomainPath(options: NxProjectOptions): string | undefined {
  const { domain: optionsDomain, scope, type } = options;

  // If the project is a tool, it should not have a domain.
  if (scope === 'tools') {
    return undefined;
  }

  // If the project has a domain, return it.
  if (optionsDomain) {
    return optionsDomain;
  }

  // If the project is not a tool and a domain isn't defined,
  // default to 'shared' for non-app projects.
  if (type !== 'app') {
    return 'shared';
  }

  // If the project is an app and a domain isn't defined, return undefined.
  return undefined;
}

/**
 * Splits a domain path into its `/`-separated segments, validating each one.
 */
export function splitDomainPath(path: string): string[] {
  const segments = path.split('/');

  for (const segment of segments) {
    assertValidPathSegment(segment, 'domain');
  }

  return segments;
}
