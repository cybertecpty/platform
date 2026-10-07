const PATH_SEGMENT_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Throws unless `value` is a single well-formed path segment: lowercase
 * alphanumeric words joined by single hyphens. Rejects empty strings,
 * leading/trailing/doubled hyphens, slashes, and uppercase — the class of
 * malformed input a leading/trailing/doubled `/` in `domain`, a stray `/` in
 * `group`, or a multi-segment generator `directory` would otherwise pass
 * through silently.
 */
export function assertValidPathSegment(value: string, optionName: string): void {
  if (!PATH_SEGMENT_PATTERN.test(value)) {
    throw new Error(
      `\`${optionName}\` segment "${value}" must be lowercase alphanumeric words joined by single hyphens.`
    );
  }
}

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
