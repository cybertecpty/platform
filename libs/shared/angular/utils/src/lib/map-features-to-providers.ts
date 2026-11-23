import type { EnvironmentProviders, Provider } from '@angular/core';

/**
 * Defines the type for an Angular provider feature and an array
 * of providers that belong to that feature.
 */
export type AngularProviderFeature<
  KindT extends string = string,
  ProviderT extends EnvironmentProviders | Provider = EnvironmentProviders | Provider
> = {
  /** Names the feature, so a union of features can be told apart. */
  kind: KindT;
  /** Providers the feature adds when it is passed to a `provideX()` function. */
  providers: readonly ProviderT[];
};

/**
 * Maps a collection of features to the collection of providers belonging
 * to those features.
 */
export function mapFeaturesToProviders<T extends EnvironmentProviders | Provider>(
  ...features: readonly AngularProviderFeature<string, T>[]
): T[] {
  return features.map(f => f.providers).flat();
}
