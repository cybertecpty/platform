import { assertValidPathSegment, domainToSegments, projectDomainToName } from './nx-domain.utils';

describe('assertValidPathSegment', () => {
  it('accepts a lowercase single word', () => {
    expect(() => assertValidPathSegment('release', 'directory')).not.toThrow();
  });

  it('accepts lowercase words joined by single hyphens', () => {
    expect(() => assertValidPathSegment('release-manifest', 'directory')).not.toThrow();
  });

  it('throws for an empty string, naming the option', () => {
    expect(() => assertValidPathSegment('', 'directory')).toThrow(
      '`directory` segment "" must be lowercase alphanumeric words joined by single hyphens.'
    );
  });

  it('throws for an uppercase segment', () => {
    expect(() => assertValidPathSegment('Release', 'directory')).toThrow(
      '`directory` segment "Release" must be lowercase alphanumeric words joined by single hyphens.'
    );
  });

  it('throws for a slash-separated value', () => {
    expect(() => assertValidPathSegment('release/manifest', 'directory')).toThrow(
      '`directory` segment "release/manifest" must be lowercase alphanumeric words joined by single hyphens.'
    );
  });

  it('throws for leading, trailing, or doubled hyphens', () => {
    expect(() => assertValidPathSegment('-release', 'directory')).toThrow();
    expect(() => assertValidPathSegment('release-', 'directory')).toThrow();
    expect(() => assertValidPathSegment('release--manifest', 'directory')).toThrow();
  });
});

describe('domainToSegments', () => {
  it('returns a single-element array for a domain with no subdomains', () => {
    expect(domainToSegments('billing')).toEqual(['billing']);
  });

  it('splits a multi-segment domain on slashes', () => {
    expect(domainToSegments('billing/checkout')).toEqual(['billing', 'checkout']);
  });

  it('throws for a segment that fails path-segment validation', () => {
    expect(() => domainToSegments('billing/Checkout')).toThrow(
      '`domain` segment "Checkout" must be lowercase alphanumeric words joined by single hyphens.'
    );
  });
});

describe('projectDomainToName', () => {
  it('leaves a domain with no subdomains unchanged', () => {
    expect(projectDomainToName('billing')).toBe('billing');
  });

  it('replaces subdomain slashes with hyphens', () => {
    expect(projectDomainToName('billing/checkout')).toBe('billing-checkout');
  });

  it('replaces every slash when there are multiple subdomains', () => {
    expect(projectDomainToName('billing/checkout/refunds')).toBe('billing-checkout-refunds');
  });

  it('throws for a leading slash', () => {
    expect(() => projectDomainToName('/billing')).toThrow(
      '`domain` segment "" must be lowercase alphanumeric words joined by single hyphens.'
    );
  });

  it('throws for a trailing slash', () => {
    expect(() => projectDomainToName('billing/')).toThrow(
      '`domain` segment "" must be lowercase alphanumeric words joined by single hyphens.'
    );
  });

  it('throws for a doubled slash', () => {
    expect(() => projectDomainToName('billing//checkout')).toThrow(
      '`domain` segment "" must be lowercase alphanumeric words joined by single hyphens.'
    );
  });

  it('throws for an uppercase segment', () => {
    expect(() => projectDomainToName('Billing')).toThrow(
      '`domain` segment "Billing" must be lowercase alphanumeric words joined by single hyphens.'
    );
  });
});
