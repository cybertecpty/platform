import { AngularProviderFeature, mapFeaturesToProviders } from './map-features-to-providers';

describe('mapFeaturesToProviders', () => {
  it('returns an empty array when no features are provided', () => {
    const result = mapFeaturesToProviders();
    expect(result).toEqual([]);
  });

  it('returns an empty array when features have no providers', () => {
    const features: AngularProviderFeature[] = [
      { kind: 'feature1', providers: [] },
      { kind: 'feature2', providers: [] }
    ];

    const result = mapFeaturesToProviders(...features);
    expect(result).toEqual([]);
  });

  it('maps providers from a single feature', () => {
    const providers: any[] = [{ provide: 'A' }, { provide: 'B' }];
    const features: AngularProviderFeature[] = [{ kind: 'feature1', providers }];

    const result = mapFeaturesToProviders(...features);
    expect(result).toEqual(providers);
  });

  it('maps providers from multiple features', () => {
    const feature1Providers: any[] = [{ provide: 'A' }];
    const feature2Providers: any[] = [{ provide: 'B' }, { provide: 'C' }];
    const features: AngularProviderFeature[] = [
      { kind: 'feature1', providers: feature1Providers },
      { kind: 'feature2', providers: feature2Providers }
    ];

    const result = mapFeaturesToProviders(...features);
    expect(result).toEqual([...feature1Providers, ...feature2Providers]);
  });

  it('handles features with mixed empty and non-empty providers', () => {
    const feature1Providers: any[] = [];
    const feature2Providers: any[] = [{ provide: 'A' }];
    const features: AngularProviderFeature[] = [
      { kind: 'feature1', providers: feature1Providers },
      { kind: 'feature2', providers: feature2Providers }
    ];

    const result = mapFeaturesToProviders(...features);
    expect(result).toEqual(feature2Providers);
  });
});
