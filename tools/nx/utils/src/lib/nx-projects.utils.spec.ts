import { logger } from '@nx/devkit';
import {
  determineTopLevelProjectDir,
  normalizeProjectOptions,
  NX_PROJECT_SCOPES,
  NX_PROJECT_TYPES,
  projectDirFromOpts,
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

describe('determineTopLevelProjectDir', () => {
  it('returns apps for an app project', () => {
    expect(
      determineTopLevelProjectDir({ name: 'game-collector', scope: 'frontend', type: 'app' })
    ).toBe('apps');
  });

  it('returns apps for an app project even when the scope is tools', () => {
    expect(determineTopLevelProjectDir({ name: 'admin', scope: 'tools', type: 'app' })).toBe(
      'apps'
    );
  });

  it('returns tools for a tools-scoped project', () => {
    expect(determineTopLevelProjectDir({ group: 'git', scope: 'tools', type: 'utils' })).toBe(
      'tools'
    );
  });

  it('returns libs for a library project', () => {
    expect(determineTopLevelProjectDir({ domain: 'billing', scope: 'backend', type: 'api' })).toBe(
      'libs'
    );
  });
});

describe('projectDirFromOpts', () => {
  it('places a library under libs/<domain>/<type>', () => {
    expect(projectDirFromOpts({ domain: 'game-collector', scope: 'backend', type: 'api' })).toBe(
      'libs/game-collector/api'
    );
  });

  it('folds subdomains into nested directories', () => {
    expect(
      projectDirFromOpts({ domain: 'billing/checkout', scope: 'backend', type: 'data-access' })
    ).toBe('libs/billing/checkout/data-access');
  });

  it('inserts the group between the domain and the type', () => {
    expect(
      projectDirFromOpts({ domain: 'shared', group: 'design-system', scope: 'shared', type: 'ui' })
    ).toBe('libs/shared/design-system/ui');
  });

  it('places a tools project under tools/<group>/<type>', () => {
    expect(projectDirFromOpts({ group: 'git', scope: 'tools', type: 'utils' })).toBe(
      'tools/git/utils'
    );
  });

  it('places an app under apps/<name>, ignoring domain and group', () => {
    expect(
      projectDirFromOpts({
        domain: 'game-collector',
        group: 'admin',
        name: 'game-collector-admin',
        scope: 'frontend',
        type: 'app'
      })
    ).toBe('apps/game-collector-admin');
  });

  it('throws for an app project with no `name`', () => {
    expect(() => projectDirFromOpts({ scope: 'frontend', type: 'app' })).toThrow(
      '`name` must be provided to derive a project directory for app projects.'
    );
  });

  it('throws when none of domain, group, or name are provided', () => {
    expect(() => projectDirFromOpts({ scope: 'backend', type: 'api' })).toThrow(
      'At least one of `domain`, `group`, or `name` must be provided to derive a project directory.'
    );
  });

  it('rejects a malformed domain the same way projectNameFromOpts does', () => {
    expect(() =>
      projectDirFromOpts({ domain: 'billing//checkout', scope: 'backend', type: 'api' })
    ).toThrow('`domain` segment "" must be lowercase alphanumeric words joined by single hyphens.');
  });

  it('rejects an uppercase domain segment', () => {
    expect(() => projectDirFromOpts({ domain: 'Billing', scope: 'backend', type: 'api' })).toThrow(
      '`domain` segment "Billing" must be lowercase alphanumeric words joined by single hyphens.'
    );
  });

  it('rejects a group containing a slash', () => {
    expect(() =>
      projectDirFromOpts({
        domain: 'billing',
        group: 'foo/bar',
        scope: 'backend',
        type: 'services'
      })
    ).toThrow(
      '`group` segment "foo/bar" must be lowercase alphanumeric words joined by single hyphens.'
    );
  });
});

describe('NX_PROJECT_SCOPES', () => {
  it('lists every recognized scope, sorted', () => {
    expect([...NX_PROJECT_SCOPES]).toEqual(['backend', 'frontend', 'shared', 'tools']);
  });
});

describe('normalizeProjectOptions', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('fills in the derived name, directory, bundler, and tag string', () => {
    expect(normalizeProjectOptions({ domain: 'billing', scope: 'backend', type: 'api' })).toEqual({
      domain: 'billing',
      scope: 'backend',
      type: 'api',
      bundler: 'none',
      directory: 'libs/billing/api',
      name: 'billing-api',
      tags: 'domain:billing,scope:backend,type:api'
    });
  });

  it('folds any freeform `tags` into the generated tag string', () => {
    const result = normalizeProjectOptions({
      name: 'legacy-lib',
      scope: 'shared',
      type: 'utils',
      tags: 'custom:one'
    });

    expect(result.tags).toBe('custom:one,domain:shared,scope:shared,type:utils');
  });

  it('derives an app project directory and name from `name` alone', () => {
    const result = normalizeProjectOptions({ name: 'vault', scope: 'frontend', type: 'app' });

    expect(result).toMatchObject({
      bundler: 'none',
      directory: 'apps/vault',
      name: 'vault',
      tags: 'scope:frontend,type:app'
    });
  });

  it('defaults the bundler to "none" when `buildable` is not requested', () => {
    expect(
      normalizeProjectOptions({ domain: 'billing', scope: 'backend', type: 'api' }).bundler
    ).toBe('none');
  });

  it('maps `buildable: true` to the tsc bundler for non-testing library types', () => {
    const result = normalizeProjectOptions({
      domain: 'billing',
      scope: 'backend',
      type: 'api',
      buildable: true
    });

    expect(result.bundler).toBe('tsc');
    expect(result).not.toHaveProperty('buildable');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('forces the bundler to "none" for a requested-buildable testing library and warns', () => {
    const result = normalizeProjectOptions({
      group: 'test-helpers',
      scope: 'shared',
      type: 'testing',
      buildable: true
    });

    expect(result.bundler).toBe('none');
    expect(warnSpy).toHaveBeenCalledWith(
      'The "testing" library type cannot be buildable. Setting bundler to "none" for project "test-helpers-testing".'
    );
  });

  it('leaves a non-buildable testing library non-buildable and does not warn', () => {
    const result = normalizeProjectOptions({
      group: 'test-helpers',
      scope: 'shared',
      type: 'testing'
    });

    expect(result.bundler).toBe('none');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('throws when neither domain, group, nor name are provided for a library', () => {
    expect(() => normalizeProjectOptions({ scope: 'shared', type: 'utils' })).toThrow(
      'At least one of `domain`, `group`, or `name` must be provided to derive a project name.'
    );
  });
});
