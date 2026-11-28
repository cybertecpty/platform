import { logger } from '@nx/devkit';
import { MockInstance } from 'vitest';
import {
  assertValidAppOption,
  assertValidPathSegment,
  determineTopLevelProjectDir,
  domainPathToName,
  forceTestingLibNotBuildable,
  normalizeProjectOptions,
  NX_PROJECT_PLATFORMS,
  NX_PROJECT_TYPES,
  PATH_SEGMENT_PATTERN,
  projectDirFromOpts,
  projectNameFromOpts,
  splitDomainPath,
  stripProjectTypeFromName
} from './project-options';

describe('project-options', () => {
  describe('NX_PROJECT_PLATFORMS', () => {
    it('lists every recognized platform, sorted', () => {
      expect([...NX_PROJECT_PLATFORMS]).toEqual(['backend', 'frontend', 'shared', 'tools']);
    });
  });

  describe('PATH_SEGMENT_PATTERN', () => {
    it.each(['release', 'release-manifest', 'e2e', '1password'])('matches `%s`', value => {
      expect(PATH_SEGMENT_PATTERN.test(value)).toBe(true);
    });

    it.each(['', 'Release', 'release/manifest', '-release', 'release-', 'release--manifest'])(
      'does not match `%s`',
      value => {
        expect(PATH_SEGMENT_PATTERN.test(value)).toBe(false);
      }
    );
  });

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

  describe('assertValidAppOption', () => {
    it('accepts a project with no `app`', () => {
      expect(() =>
        assertValidAppOption({ domain: 'billing', platform: 'frontend', type: 'ui' })
      ).not.toThrow();
    });

    it('accepts a frontend lib of a product domain owned by an app', () => {
      expect(() =>
        assertValidAppOption({
          app: 'cybertec-io',
          domain: 'billing/checkout',
          platform: 'frontend',
          type: 'ui'
        })
      ).not.toThrow();
    });

    it('rejects `app` on an app project', () => {
      expect(() =>
        assertValidAppOption({
          app: 'vault',
          name: 'vault-admin',
          platform: 'frontend',
          type: 'app'
        })
      ).toThrow('`app` cannot be set for an app project.');
    });

    it('rejects `app` on a tools project', () => {
      expect(() =>
        assertValidAppOption({ app: 'vault', group: 'git', platform: 'tools', type: 'utils' })
      ).toThrow('`app` cannot be set for a `platform:tools` project.');
    });

    it('rejects `app` with the `shared` domain', () => {
      expect(() =>
        assertValidAppOption({ app: 'vault', domain: 'shared', platform: 'frontend', type: 'ui' })
      ).toThrow('`app` cannot be set for the `shared` domain');
    });

    it('rejects `app` with no domain, which defaults to `shared`', () => {
      expect(() =>
        assertValidAppOption({ app: 'vault', group: 'forms', platform: 'frontend', type: 'ui' })
      ).toThrow('`app` cannot be set for the `shared` domain');
    });

    it.each(['e2e', 'e2e/smoke'])(
      'rejects the domain `%s`, which sits inside the e2e project',
      domain => {
        expect(() =>
          assertValidAppOption({ app: 'vault', domain, platform: 'frontend', type: 'ui' })
        ).toThrow('`domain` cannot start with `e2e`');
      }
    );

    it('rejects a malformed app name', () => {
      expect(() =>
        assertValidAppOption({
          app: 'Vault/Admin',
          domain: 'billing',
          platform: 'frontend',
          type: 'ui'
        })
      ).toThrow('`app` segment "Vault/Admin" must be lowercase alphanumeric words');
    });
  });

  describe('determineTopLevelProjectDir', () => {
    it('returns apps/<app> for a lib owned by an app', () => {
      expect(
        determineTopLevelProjectDir({
          app: 'cybertec-io',
          domain: 'billing',
          platform: 'frontend',
          type: 'ui'
        })
      ).toBe('apps/cybertec-io');
    });

    it('returns apps for an app project', () => {
      expect(
        determineTopLevelProjectDir({ name: 'game-collector', platform: 'frontend', type: 'app' })
      ).toBe('apps');
    });

    it('returns apps for an app project even when the platform is tools', () => {
      expect(determineTopLevelProjectDir({ name: 'admin', platform: 'tools', type: 'app' })).toBe(
        'apps'
      );
    });

    it('returns tools for a tools-scoped project', () => {
      expect(determineTopLevelProjectDir({ group: 'git', platform: 'tools', type: 'utils' })).toBe(
        'tools'
      );
    });

    it('returns libs for a library project', () => {
      expect(
        determineTopLevelProjectDir({ domain: 'billing', platform: 'backend', type: 'api' })
      ).toBe('libs');
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

  describe('forceTestingLibNotBuildable', () => {
    let warnSpy: MockInstance;

    beforeEach(() => {
      warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('downgrades a requested js bundler on a testing lib to "none" and warns', () => {
      const result = forceTestingLibNotBuildable({
        name: 'test-helpers-testing',
        option: 'bundler',
        type: 'testing',
        value: 'tsc'
      });

      expect(result).toBe('none');
      expect(warnSpy).toHaveBeenCalledWith(
        'The "testing" library type cannot be buildable. Setting bundler to "none" for project "test-helpers-testing".'
      );
    });

    it.each(['buildable', 'publishable'] as const)(
      'downgrades `%s: true` on a testing lib to false and warns',
      option => {
        const result = forceTestingLibNotBuildable({
          name: 'test-helpers-testing',
          option,
          type: 'testing',
          value: true
        });

        expect(result).toBe(false);
        expect(warnSpy).toHaveBeenCalledWith(
          `The "testing" library type cannot be buildable. Setting ${option} to false for project "test-helpers-testing".`
        );
      }
    );

    it.each([
      ['bundler', 'none'],
      ['bundler', undefined],
      ['buildable', false],
      ['publishable', undefined]
    ] as const)(
      'leaves a non-buildable testing lib (%s: %s) alone without warning',
      (option, value) => {
        const result = forceTestingLibNotBuildable({
          name: 'test-helpers-testing',
          option,
          type: 'testing',
          value
        });

        expect(result).toBe(value);
        expect(warnSpy).not.toHaveBeenCalled();
      }
    );

    it('leaves a non-testing lib’s requested value untouched without warning', () => {
      expect(
        forceTestingLibNotBuildable({
          name: 'billing-utils',
          option: 'bundler',
          type: 'utils',
          value: 'vite'
        })
      ).toBe('vite');
      expect(
        forceTestingLibNotBuildable({
          name: 'billing-utils',
          option: 'buildable',
          type: 'utils',
          value: true
        })
      ).toBe(true);
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('normalizeProjectOptions', () => {
    it('fills in the derived name, directory, and tag string', () => {
      expect(
        normalizeProjectOptions({ domain: 'billing', platform: 'backend', type: 'api' })
      ).toEqual({
        domain: 'billing',
        platform: 'backend',
        type: 'api',
        directory: 'libs/billing/api',
        name: 'billing-api',
        tags: 'domain:billing,platform:backend,type:api'
      });
    });

    it('folds any freeform `tags` into the generated tag string', () => {
      const result = normalizeProjectOptions({
        name: 'legacy-lib',
        platform: 'shared',
        type: 'utils',
        tags: 'custom:one'
      });

      expect(result.tags).toBe('custom:one,domain:shared,platform:shared,type:utils');
    });

    it('derives an app project directory and name from `name` alone', () => {
      const result = normalizeProjectOptions({ name: 'vault', platform: 'frontend', type: 'app' });

      expect(result).toMatchObject({
        directory: 'apps/vault',
        name: 'vault',
        tags: 'platform:frontend,type:app'
      });
    });

    it('throws when neither domain, group, nor name are provided for a library', () => {
      expect(() => normalizeProjectOptions({ platform: 'shared', type: 'utils' })).toThrow(
        'At least one of `domain`, `group`, or `name` must be provided to derive a project name.'
      );
    });
  });

  describe('projectDirFromOpts', () => {
    it('places a library under libs/<domain>/<type>', () => {
      expect(
        projectDirFromOpts({ domain: 'game-collector', platform: 'backend', type: 'api' })
      ).toBe('libs/game-collector/api');
    });

    it('folds subdomains into nested directories', () => {
      expect(
        projectDirFromOpts({ domain: 'billing/checkout', platform: 'backend', type: 'data-access' })
      ).toBe('libs/billing/checkout/data-access');
    });

    it('inserts the group between the domain and the type', () => {
      expect(
        projectDirFromOpts({
          domain: 'shared',
          group: 'design-system',
          platform: 'shared',
          type: 'ui'
        })
      ).toBe('libs/shared/design-system/ui');
    });

    it('places a lib owned by an app under apps/<app>/<domain>/<group>/<type>', () => {
      expect(
        projectDirFromOpts({
          app: 'cybertec-io',
          domain: 'billing/checkout',
          group: 'cart',
          platform: 'frontend',
          type: 'feature'
        })
      ).toBe('apps/cybertec-io/billing/checkout/cart/feature');
    });

    it('keeps the directory when `name` overrides the name of a lib owned by an app', () => {
      expect(
        projectDirFromOpts({
          app: 'cybertec-io',
          domain: 'billing',
          name: 'custom',
          platform: 'frontend',
          type: 'ui'
        })
      ).toBe('apps/cybertec-io/billing/ui');
    });

    it('rejects an app-owned lib in the shared domain before deriving a directory', () => {
      expect(() =>
        projectDirFromOpts({
          app: 'cybertec-io',
          domain: 'shared',
          platform: 'frontend',
          type: 'ui'
        })
      ).toThrow('`app` cannot be set for the `shared` domain');
    });

    it('places a tools project under tools/<group>/<type>', () => {
      expect(projectDirFromOpts({ group: 'git', platform: 'tools', type: 'utils' })).toBe(
        'tools/git/utils'
      );
    });

    it('places an app under apps/<name>, ignoring domain and group', () => {
      expect(
        projectDirFromOpts({
          domain: 'game-collector',
          group: 'admin',
          name: 'game-collector-admin',
          platform: 'frontend',
          type: 'app'
        })
      ).toBe('apps/game-collector-admin');
    });

    it('throws for an app project with no `name`', () => {
      expect(() => projectDirFromOpts({ platform: 'frontend', type: 'app' })).toThrow(
        '`name` must be provided to derive a project directory for app projects.'
      );
    });

    it('throws when none of domain, group, or name are provided', () => {
      expect(() => projectDirFromOpts({ platform: 'backend', type: 'api' })).toThrow(
        'At least one of `domain`, `group`, or `name` must be provided to derive a project directory.'
      );
    });

    it('rejects a malformed domain the same way projectNameFromOpts does', () => {
      expect(() =>
        projectDirFromOpts({ domain: 'billing//checkout', platform: 'backend', type: 'api' })
      ).toThrow(
        '`domain` segment "" must be lowercase alphanumeric words joined by single hyphens.'
      );
    });

    it('rejects an uppercase domain segment', () => {
      expect(() =>
        projectDirFromOpts({ domain: 'Billing', platform: 'backend', type: 'api' })
      ).toThrow(
        '`domain` segment "Billing" must be lowercase alphanumeric words joined by single hyphens.'
      );
    });

    it('rejects a group containing a slash', () => {
      expect(() =>
        projectDirFromOpts({
          domain: 'billing',
          group: 'foo/bar',
          platform: 'backend',
          type: 'services'
        })
      ).toThrow(
        '`group` segment "foo/bar" must be lowercase alphanumeric words joined by single hyphens.'
      );
    });
  });

  describe('projectNameFromOpts', () => {
    it('throws when none of domain, group, or name are provided', () => {
      expect(() => projectNameFromOpts({ platform: 'shared', type: 'utils' })).toThrow(
        'At least one of `domain`, `group`, or `name` must be provided to derive a project name.'
      );
    });

    it('derives `<domain>-<type>` when only domain is provided', () => {
      expect(
        projectNameFromOpts({ domain: 'game-collector', platform: 'backend', type: 'api' })
      ).toBe('game-collector-api');
    });

    it('folds subdomains into the domain segment', () => {
      expect(
        projectNameFromOpts({
          domain: 'billing/checkout',
          platform: 'backend',
          type: 'data-access'
        })
      ).toBe('billing-checkout-data-access');
    });

    it('derives `<group>-<type>` when only group is provided (tools convention)', () => {
      expect(projectNameFromOpts({ group: 'git', platform: 'tools', type: 'utils' })).toBe(
        'git-utils'
      );
    });

    it('derives `<domain>-<group>-<type>` when both domain and group are provided', () => {
      expect(
        projectNameFromOpts({
          domain: 'game-collector',
          group: 'admin',
          platform: 'frontend',
          type: 'ui'
        })
      ).toBe('game-collector-admin-ui');
    });

    it('drops the `shared` domain from the name when no group is provided', () => {
      expect(projectNameFromOpts({ domain: 'shared', platform: 'shared', type: 'utils' })).toBe(
        'utils'
      );
    });

    it('drops the `shared` domain from the name once a group is provided', () => {
      expect(
        projectNameFromOpts({
          domain: 'shared',
          group: 'design-system',
          platform: 'shared',
          type: 'ui'
        })
      ).toBe('design-system-ui');
    });

    it('returns `name` verbatim, bypassing the derivation formula entirely', () => {
      expect(
        projectNameFromOpts({
          domain: 'billing',
          group: 'checkout',
          name: 'legacy-checkout-lib',
          platform: 'backend',
          type: 'services'
        })
      ).toBe('legacy-checkout-lib');
    });

    it('accepts `name` alone with no domain or group', () => {
      expect(projectNameFromOpts({ name: 'legacy-lib', platform: 'shared', type: 'utils' })).toBe(
        'legacy-lib'
      );
    });

    it('returns `name` exclusively for app projects', () => {
      expect(
        projectNameFromOpts({ name: 'game-collector', platform: 'frontend', type: 'app' })
      ).toBe('game-collector');
    });

    it('ignores domain/group when deriving an app project name', () => {
      expect(
        projectNameFromOpts({
          domain: 'game-collector',
          group: 'admin',
          name: 'game-collector-admin-app',
          platform: 'frontend',
          type: 'app'
        })
      ).toBe('game-collector-admin-app');
    });

    it('throws for an app project with no `name`, even when domain/group are provided', () => {
      expect(() =>
        projectNameFromOpts({
          domain: 'game-collector',
          group: 'admin',
          platform: 'frontend',
          type: 'app'
        })
      ).toThrow('`name` must be provided to derive a project name for app projects.');
    });

    it('throws for a group containing a slash', () => {
      expect(() =>
        projectNameFromOpts({
          domain: 'billing',
          group: 'foo/bar',
          platform: 'backend',
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
          platform: 'backend',
          type: 'services'
        })
      ).toThrow(
        '`group` segment "Orchestration" must be lowercase alphanumeric words joined by single hyphens.'
      );
    });
  });

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
});
