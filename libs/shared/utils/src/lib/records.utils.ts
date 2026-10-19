/**
 * Returns a copy of `record` with its keys ordered by UTF-16 code unit, the same order
 * `Array.prototype.sort` gives, so the result does not depend on the machine's locale.
 * That puts uppercase before lowercase, and `_` between them (`B`, `_x`, `a`).
 *
 * Only string keys are carried over; symbol keys are dropped. JavaScript always lists
 * integer-like keys (`'1'`, `'10'`) first, in ascending numeric order, whatever `dir` says.
 *
 * @param record - Record whose keys to order.
 * @param dir - `'asc'` (default) or `'desc'`.
 * @returns A new record with the same entries in key order.
 */
export function orderByKeys<T extends Record<string, unknown>>(
  record: T,
  dir: 'asc' | 'desc' = 'asc'
): T {
  const sign = dir === 'asc' ? 1 : -1;
  const entries = Object.entries(record).sort(([keyA], [keyB]) => {
    if (keyA === keyB) {
      return 0;
    }

    return keyA < keyB ? -sign : sign;
  });

  return Object.fromEntries(entries) as T;
}
