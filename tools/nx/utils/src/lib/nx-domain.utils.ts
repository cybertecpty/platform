import { assertValidPathSegment } from './nx-path-segment.utils';

/**
 * Splits a domain into its `/`-separated segments, validating each one.
 */
export function domainToSegments(domain: string): string[] {
  const segments = domain.split('/');

  for (const segment of segments) {
    assertValidPathSegment(segment, 'domain');
  }

  return segments;
}

/**
 * Converts a project domain to a name by validating each `/`-separated
 * segment and joining them with hyphens. Also the form a `domain` tag takes
 * for a subdomain-bearing project (ADR 0009: `domain:<domain>-<subdomain>`).
 */
export function projectDomainToName(domain: string): string {
  return domainToSegments(domain).join('-');
}
