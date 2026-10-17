/**
 * Orders a record by its keys.
 *
 * @param record - Record to sort by keys.
 * @param dir - Sorting direction ('asc' for ascending, 'desc' for descending). Default is 'asc'.
 * @returns A record with sorted keys.
 */
export function orderByKeys<T extends Record<PropertyKey, unknown>>(
  record: T,
  dir: 'asc' | 'desc' = 'asc'
): T {
  const keysValues = Object.entries(record);
  const sortedKeysValues = keysValues.sort(([keyA], [keyB]) =>
    dir === 'asc'
      ? String(keyA).localeCompare(String(keyB))
      : String(keyB).localeCompare(String(keyA))
  );

  return Object.fromEntries(sortedKeysValues) as T;
}
