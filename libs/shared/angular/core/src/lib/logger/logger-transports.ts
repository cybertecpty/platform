import { InjectionToken, isDevMode } from '@angular/core';
import { ConsoleTransport, type LogTransport } from '@cybertecpty/logging-utils';
import { type LoggerFeature, LoggerFeatureKind } from './logger-feature';

export type LoggerTransportsFeature = LoggerFeature<LoggerFeatureKind.Transports>;

/**
 * The transports the root `Logger` writes to: the ones `withTransports` registers, or a default
 * console transport.
 */
export const LOGGER_TRANSPORTS = new InjectionToken<readonly LogTransport[]>('LOGGER_TRANSPORTS', {
  providedIn: 'root',
  factory: createDefaultTransports
});

/**
 * Replaces the default console transport with the given ones. Pass a `ConsoleTransport` as well
 * to keep console output; a transport you supply is not enabled in dev mode, so call
 * `enableAll()` on it for that. When provided twice, the last call wins.
 */
export function withTransports(...transports: LogTransport[]): LoggerTransportsFeature {
  return {
    kind: LoggerFeatureKind.Transports,
    providers: [{ provide: LOGGER_TRANSPORTS, useValue: transports }]
  };
}

function createDefaultTransports(): LogTransport[] {
  const transport = new ConsoleTransport();

  if (isDevMode()) {
    // Enable all console logging by default in dev mode
    transport.enableAll();
  }

  return [transport];
}
