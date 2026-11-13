import { createDependencyGraphFixture, createProjectNodeFixture } from '@cybertecpty/nx-testing';
import { logger, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import type { MockInstance } from 'vitest';
import {
  addProjectTarget,
  BACKEND_LIB_TYPES,
  collectProjectDependencies,
  determineTopLevelProjectDir,
  normalizeProjectOptions,
  NX_PROJECT_PLATFORMS,
  NX_PROJECT_TYPES,
  projectDirFromOpts,
  projectNameFromOpts,
  readProjectPackageJson,
  stripProjectTypeFromName
} from './nx-projects.utils';

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
      projectNameFromOpts({ domain: 'billing/checkout', platform: 'backend', type: 'data-access' })
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
    expect(projectNameFromOpts({ name: 'game-collector', platform: 'frontend', type: 'app' })).toBe(
      'game-collector'
    );
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

describe('readProjectPackageJson', () => {
  const projectRoot = 'libs/demo/utils';
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('returns the parsed package.json in the project root', () => {
    tree.write(`${projectRoot}/package.json`, JSON.stringify({ name: '@proj/demo-utils' }));

    expect(readProjectPackageJson(tree, projectRoot)).toEqual({ name: '@proj/demo-utils' });
  });

  it('returns undefined when the project has no package.json', () => {
    expect(readProjectPackageJson(tree, projectRoot)).toBeUndefined();
  });

  it('throws when the package.json is not valid JSON', () => {
    tree.write(`${projectRoot}/package.json`, '{ not valid json');

    expect(() => readProjectPackageJson(tree, projectRoot)).toThrow();
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

describe('projectDirFromOpts', () => {
  it('places a library under libs/<domain>/<type>', () => {
    expect(projectDirFromOpts({ domain: 'game-collector', platform: 'backend', type: 'api' })).toBe(
      'libs/game-collector/api'
    );
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
    ).toThrow('`domain` segment "" must be lowercase alphanumeric words joined by single hyphens.');
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

describe('BACKEND_LIB_TYPES', () => {
  it('lists the backend types, sorted', () => {
    expect([...BACKEND_LIB_TYPES]).toEqual(['api', 'infra', 'services']);
  });
});

describe('NX_PROJECT_PLATFORMS', () => {
  it('lists every recognized platform, sorted', () => {
    expect([...NX_PROJECT_PLATFORMS]).toEqual(['backend', 'frontend', 'shared', 'tools']);
  });
});

describe('normalizeProjectOptions', () => {
  let warnSpy: MockInstance;

  beforeEach(() => {
    warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('fills in the derived name, directory, bundler, and tag string', () => {
    expect(
      normalizeProjectOptions({ domain: 'billing', platform: 'backend', type: 'api' })
    ).toEqual({
      domain: 'billing',
      platform: 'backend',
      type: 'api',
      bundler: 'none',
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
      bundler: 'none',
      directory: 'apps/vault',
      name: 'vault',
      tags: 'platform:frontend,type:app'
    });
  });

  it('defaults the bundler to "none" when `buildable` is not requested', () => {
    expect(
      normalizeProjectOptions({ domain: 'billing', platform: 'backend', type: 'api' }).bundler
    ).toBe('none');
  });

  it('maps `buildable: true` to the tsc bundler for non-testing library types', () => {
    const result = normalizeProjectOptions({
      domain: 'billing',
      platform: 'backend',
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
      platform: 'shared',
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
      platform: 'shared',
      type: 'testing'
    });

    expect(result.bundler).toBe('none');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('throws when neither domain, group, nor name are provided for a library', () => {
    expect(() => normalizeProjectOptions({ platform: 'shared', type: 'utils' })).toThrow(
      'At least one of `domain`, `group`, or `name` must be provided to derive a project name.'
    );
  });
});

describe('addProjectTarget', () => {
  it('adds the target to a project that has no targets', () => {
    const config = addProjectTarget({ root: 'apps/web' }, 'deploy', { executor: 'nx:noop' });

    expect(config.targets).toEqual({ deploy: { executor: 'nx:noop' } });
  });

  it('keeps the existing targets', () => {
    const config = addProjectTarget(
      { root: 'apps/web', targets: { build: { executor: 'nx:noop' } } },
      'deploy',
      { executor: 'nx:noop' }
    );

    expect(Object.keys(config.targets ?? {})).toEqual(['build', 'deploy']);
  });

  it('replaces a target of the same name that runs the same executor', () => {
    const config = addProjectTarget(
      { root: 'apps/web', targets: { deploy: { executor: 'nx:noop', options: { a: 1 } } } },
      'deploy',
      { executor: 'nx:noop', options: { a: 2 } }
    );

    expect(config.targets?.['deploy']).toEqual({ executor: 'nx:noop', options: { a: 2 } });
  });

  it('throws, naming the project, target and executor, when another executor owns the target', () => {
    expect(() =>
      addProjectTarget(
        { name: 'web', root: 'apps/web', targets: { deploy: { executor: 'nx:noop' } } },
        'deploy',
        { executor: 'nx:run-commands' }
      )
    ).toThrow(
      'Project web already has a "deploy" target that runs nx:noop. Rename or remove it first.'
    );
  });

  it('names the project root when the project has no name', () => {
    expect(() =>
      addProjectTarget(
        { root: 'apps/web', targets: { deploy: { executor: 'nx:noop' } } },
        'deploy',
        { executor: 'nx:run-commands' }
      )
    ).toThrow('Project apps/web already has');
  });

  it('replaces a target that runs another executor when replace is set', () => {
    const config = addProjectTarget(
      { root: 'apps/web', targets: { deploy: { executor: 'nx:noop', options: { a: 1 } } } },
      'deploy',
      { executor: 'nx:run-commands' },
      { replace: true }
    );

    expect(config.targets?.['deploy']).toEqual({ executor: 'nx:run-commands' });
  });

  it('returns the project configuration it was given', () => {
    const input = { root: 'apps/web' };

    expect(addProjectTarget(input, 'deploy', { executor: 'nx:noop' })).toBe(input);
  });
});

describe('collectProjectDependencies', () => {
  const graph = createDependencyGraphFixture(
    [
      createProjectNodeFixture({ name: 'web', type: 'app' }),
      createProjectNodeFixture({ name: 'ui' }),
      createProjectNodeFixture({ name: 'core' }),
      createProjectNodeFixture({ name: 'unrelated' })
    ],
    [
      ['web', 'ui'],
      ['ui', 'core'],
      ['web', 'npm:react']
    ]
  );

  it('follows workspace dependencies transitively and skips external packages', () => {
    expect(collectProjectDependencies(graph, 'web')).toEqual(['ui', 'core']);
  });

  it('returns nothing for a project that depends on nothing', () => {
    expect(collectProjectDependencies(graph, 'unrelated')).toEqual([]);
  });

  it('returns nothing for a project that is not in the graph', () => {
    expect(collectProjectDependencies(graph, 'missing')).toEqual([]);
  });

  it('survives a dependency cycle without listing the project itself', () => {
    const cyclic = createDependencyGraphFixture(
      [
        createProjectNodeFixture({ name: 'a', type: 'app' }),
        createProjectNodeFixture({ name: 'b' })
      ],
      [
        ['a', 'b'],
        ['b', 'a']
      ]
    );

    expect(collectProjectDependencies(cyclic, 'a')).toEqual(['b']);
  });
});
