/**
 * A single well-formed path segment: lowercase alphanumeric words joined by single
 * hyphens. The `pattern` of every `schema.json` option that mirrors
 * `assertValidPathSegment` must stay equivalent to this.
 */
export const PATH_SEGMENT_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

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
