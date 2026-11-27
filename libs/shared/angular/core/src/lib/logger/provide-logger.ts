import { inject, makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';
import { mapFeaturesToProviders, type AngularProviderFeature } from '@cybertecpty/angular-utils';
import { Logger } from '@cybertecpty/logging-utils';
import { LOGGER_TRANSPORTS } from './with-logger-transports';

/**
 * Provides the root `Logger` for the application. Without `withLoggerTransports`, it writes to a
 * `ConsoleTransport` with every level enabled in dev mode.
 *
 * @param appCode The root namespace, lower-cased, that every scoped logger extends
 * @param features Optional `withX()` features that configure the logger
 */
export function provideLogger(
  appCode: string,
  ...features: AngularProviderFeature[]
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
