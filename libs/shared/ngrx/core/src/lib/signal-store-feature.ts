import type { AngularProviderFeature } from '@cybertecpty/angular-utils';

export type SignalStoreFeature<T extends SignalStoreFeatureKind> = AngularProviderFeature<T>;

export enum SignalStoreFeatureKind {
  EventsLogging = 'EventsLogging'
}
