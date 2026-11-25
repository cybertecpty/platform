import type { LogTransport } from '@cybertecpty/logging-utils';

/** A `LogTransport` whose methods are `vitest.fn()` spies; `isEnabled` returns `true`. */
export const createMockTransport = (): LogTransport => ({
  enableAll: vitest.fn(),
  initialize: vitest.fn(),
  isEnabled: vitest.fn().mockReturnValue(true),
  log: vitest.fn()
});
