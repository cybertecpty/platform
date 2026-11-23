import type { FactoryProvider } from '@angular/core';
import { Logger } from '@cybertecpty/logging-utils';

/**
 * Provides a `Logger` with no transports, so code that calls `injectLogger` runs in a test
 * without `provideLogger` and logs nothing.
 *
 * @param appCode The root namespace, so `injectLogger('Invoice')` is `{appCode}:invoice`
 */
export function provideMockLogger(appCode = 'test'): FactoryProvider {
  return { provide: Logger, useFactory: () => new Logger(appCode, []) };
}
