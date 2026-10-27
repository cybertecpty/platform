import { domainPathToName, splitDomainPath } from './nx-domain.utils';

describe('splitDomainPath', () => {
  it('returns a single-element array for a domain with no subdomains', () => {
    expect(splitDomainPath('billing')).toEqual(['billing']);
  });

  it('splits a multi-segment domain on slashes', () => {
    expect(splitDomainPath('billing/checkout')).toEqual(['billing', 'checkout']);
  });

  it('throws for a segment that fails path-segment validation', () => {
    expect(() => splitDomainPath('billing/Checkout')).toThrow(
      '`domain` segment "Checkout" must be lowercase alphanumeric words joined by single hyphens.'
    );
  });
});

describe('domainPathToName', () => {
  it('leaves a domain with no subdomains unchanged', () => {
    expect(domainPathToName('billing')).toBe('billing');
  });

  it('replaces subdomain slashes with hyphens', () => {
    expect(domainPathToName('billing/checkout')).toBe('billing-checkout');
  });

  it('replaces every slash when there are multiple subdomains', () => {
    expect(domainPathToName('billing/checkout/refunds')).toBe('billing-checkout-refunds');
  });

  it('throws for a leading slash', () => {
    expect(() => domainPathToName('/billing')).toThrow(
      '`domain` segment "" must be lowercase alphanumeric words joined by single hyphens.'
    );
  });

  it('throws for a trailing slash', () => {
    expect(() => domainPathToName('billing/')).toThrow(
      '`domain` segment "" must be lowercase alphanumeric words joined by single hyphens.'
    );
  });

  it('throws for a doubled slash', () => {
    expect(() => domainPathToName('billing//checkout')).toThrow(
      '`domain` segment "" must be lowercase alphanumeric words joined by single hyphens.'
    );
  });

  it('throws for an uppercase segment', () => {
    expect(() => domainPathToName('Billing')).toThrow(
      '`domain` segment "Billing" must be lowercase alphanumeric words joined by single hyphens.'
    );
  });
});
