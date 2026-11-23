import type { AngularProviderFeature } from '@cybertecpty/angular-utils';

export type LoggerFeature<T extends LoggerFeatureKind> = AngularProviderFeature<T>;

/**
 * Discriminates the logger features that `provideLogger` accepts.
 */
export enum LoggerFeatureKind {
  RouterEventsLogging = 'RouterEventsLogging',
  Transports = 'Transports'
}
