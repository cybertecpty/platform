import { inject, makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';
import { mapFeaturesToProviders } from '@cybertecpty/angular-utils';
import { Logger } from '@cybertecpty/logging-utils';
import { LOGGER_TRANSPORTS, type LoggerTransportsFeature } from './logger-transports';
import type { RouterEventsLoggingFeature } from './router-events-logging';

export type LoggerFeatures = LoggerTransportsFeature | RouterEventsLoggingFeature;

/**
 * Provides the root `Logger` for the application. Without `withTransports`, it writes to a
 * `ConsoleTransport` with every level enabled in dev mode.
 *
 * @param appCode The root namespace, lower-cased, that every scoped logger extends
 * @param features Optional `withX()` features that configure the logger
 */
export function provideLogger(
  appCode: string,
  ...features: LoggerFeatures[]
): EnvironmentProviders {
  return makeEnvironmentProviders([
    ...mapFeaturesToProviders(...features),
    {
      provide: Logger,
      useFactory: () => {
        const namespace = appCode.toLowerCase();
        return new Logger(namespace, inject(LOGGER_TRANSPORTS));
      }
    }
  ]);
}
