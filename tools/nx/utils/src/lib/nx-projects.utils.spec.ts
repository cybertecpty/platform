import {
  NX_PROJECT_TYPES,
  projectDomainToName,
  projectNameFromOpts,
  stripProjectTypeFromName
} from './nx-projects.utils';

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

describe('projectNameFromOpts', () => {
  it('throws when none of domain, group, or name are provided', () => {
    expect(() => projectNameFromOpts({ scope: 'shared', type: 'utils' })).toThrow(
      'At least one of `domain`, `group`, or `name` must be provided to derive a project name.'
    );
  });

  it('derives `<domain>-<type>` when only domain is provided', () => {
    expect(projectNameFromOpts({ domain: 'game-collector', scope: 'backend', type: 'api' })).toBe(
      'game-collector-api'
    );
  });

  it('folds subdomains into the domain segment', () => {
    expect(
      projectNameFromOpts({ domain: 'billing/checkout', scope: 'backend', type: 'data-access' })
    ).toBe('billing-checkout-data-access');
  });

  it('derives `<group>-<type>` when only group is provided (tools convention)', () => {
    expect(projectNameFromOpts({ group: 'git', scope: 'tools', type: 'utils' })).toBe('git-utils');
  });

  it('derives `<domain>-<group>-<type>` when both domain and group are provided', () => {
    expect(
      projectNameFromOpts({ domain: 'shared', group: 'design-system', scope: 'shared', type: 'ui' })
    ).toBe('shared-design-system-ui');
  });

  it('returns `name` verbatim, bypassing the derivation formula entirely', () => {
    expect(
      projectNameFromOpts({
        domain: 'billing',
        group: 'checkout',
        name: 'legacy-checkout-lib',
        scope: 'backend',
        type: 'services'
      })
    ).toBe('legacy-checkout-lib');
  });

  it('accepts `name` alone with no domain or group', () => {
    expect(projectNameFromOpts({ name: 'legacy-lib', scope: 'shared', type: 'utils' })).toBe(
      'legacy-lib'
    );
  });

  it('returns `name` exclusively for app projects', () => {
    expect(projectNameFromOpts({ name: 'game-collector', scope: 'frontend', type: 'app' })).toBe(
      'game-collector'
    );
  });

  it('ignores domain/group when deriving an app project name', () => {
    expect(
      projectNameFromOpts({
        domain: 'game-collector',
        group: 'admin',
        name: 'game-collector-admin-app',
        scope: 'frontend',
        type: 'app'
      })
    ).toBe('game-collector-admin-app');
  });

  it('throws for an app project with no `name`, even when domain/group are provided', () => {
    expect(() =>
      projectNameFromOpts({
        domain: 'game-collector',
        group: 'admin',
        scope: 'frontend',
        type: 'app'
      })
    ).toThrow('`name` must be provided to derive a project name for app projects.');
  });

  it('throws for a group containing a slash', () => {
    expect(() =>
      projectNameFromOpts({
        domain: 'billing',
        group: 'foo/bar',
        scope: 'backend',
        type: 'services'
      })
    ).toThrow(
      '`group` segment "foo/bar" must be lowercase alphanumeric words joined by single hyphens.'
    );
  });

  it('throws for an uppercase group', () => {
    expect(() =>
      projectNameFromOpts({
        domain: 'billing',
        group: 'Orchestration',
        scope: 'backend',
        type: 'services'
      })
    ).toThrow(
      '`group` segment "Orchestration" must be lowercase alphanumeric words joined by single hyphens.'
    );
  });
});

describe('stripProjectTypeFromName', () => {
  it('removes a recognized type suffix', () => {
    expect(stripProjectTypeFromName('game-collector-api')).toBe('game-collector');
  });

  it('removes a multi-segment type suffix', () => {
    expect(stripProjectTypeFromName('billing-checkout-data-access')).toBe('billing-checkout');
  });

  it('leaves a name with no recognized type suffix unchanged', () => {
    expect(stripProjectTypeFromName('legacy-checkout-lib')).toBe('legacy-checkout-lib');
  });

  it.each(NX_PROJECT_TYPES)('removes every recognized type suffix, including %s', type => {
    expect(stripProjectTypeFromName(`sample-${type}`)).toBe('sample');
  });
});
