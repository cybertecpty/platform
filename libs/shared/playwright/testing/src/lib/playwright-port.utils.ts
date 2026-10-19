import { createHash } from 'node:crypto';

export interface PortRange {
  /** First port of the range. Must be unprivileged (1024 or above). */
  base: number;
  /** How many ports the range holds. */
  span: number;
}

export const MAX_PORT = 65_535;
export const MIN_UNPRIVILEGED_PORT = 1024;

/**
 * Maps a key (usually an absolute workspace path) to a stable port inside the range, so every
 * checkout of a repo gets its own port and the same checkout always gets the same one. Path
 * separators, letter case and a trailing separator don't change the result.
 *
 * Two keys can still land on the same port, so pair it with a server check that fails when the
 * port is already taken rather than reusing whatever answers there.
 */
export function derivePort(key: string, { base, span }: PortRange): number {
  if (
    !Number.isInteger(base) ||
    !Number.isInteger(span) ||
    base < MIN_UNPRIVILEGED_PORT ||
    span < 1 ||
    base + span - 1 > MAX_PORT
  ) {
    throw new RangeError(
      `Port range base=${base} span=${span} must be whole numbers inside ${MIN_UNPRIVILEGED_PORT}-${MAX_PORT}`
    );
  }

  const normalized = key.replaceAll('\\', '/').replace(/\/+$/, '').toLowerCase();
  const hash = createHash('sha256').update(normalized).digest();

  return base + (hash.readUInt32BE(0) % span);
}
