import { inject } from '@angular/core';
import { Logger } from '@cybertecpty/logging-utils';

/**
 * Injects a Logger scoped to the given source name, which `Logger.extendScope`
 * converts to kebab-case. Pass a string, not `MyClass.name`, because minified builds
 * rename classes.
 *
 * @param source The static scope name, such as `InvoiceService`
 * @returns A scoped Logger instance
 * @throws When `provideLogger()` is missing from the application config
 */
export function injectLogger(source: string): Logger {
  const logger = inject(Logger, { optional: true });

  if (!logger) {
    throw new Error('injectLogger() needs provideLogger() in the application config');
  }

  return logger.extendScope(source);
}
