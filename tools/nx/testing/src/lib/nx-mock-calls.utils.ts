/** The part of a Jest mock this helper reads: its recorded call arguments. */
interface MockWithCalls<TArgs extends unknown[]> {
  mock: { calls: TArgs[] };
}

/**
 * Return the argument at `index` of the mock's most recent call. Throws,
 * naming the mock as `name`, when the mock was never called, so a spec fails
 * with a clear message instead of reading a property of `undefined`.
 */
export function lastCallArg<TArgs extends unknown[], TIndex extends number>(
  mock: MockWithCalls<TArgs>,
  index: TIndex,
  name: string
): TArgs[TIndex] {
  const lastCall = mock.mock.calls.at(-1);

  if (!lastCall) {
    throw new Error(`${name} was never called`);
  }

  return lastCall[index];
}
