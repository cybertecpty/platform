import { createProjectNodeFixture } from '@cybertecpty/nx-testing';
import type { DependencyConstraint } from '@cybertecpty/nx-types';
import type { ProjectGraphProjectNode } from '@nx/devkit';
import { existsSync } from 'node:fs';
import { basename } from 'node:path';
import {
  checkBannedTagsViolations,
  checkDepConstraints,
  checkExpectedTagsViolations,
  DEP_CONSTRAINTS_PATH,
  isComboSrcTagConstraint,
  isSingleSrcTagConstraint,
  loadDepConstraints
} from './nx-dep-constraints.utils';

const API_CONSTRAINT_FIXTURE: DependencyConstraint = {
  sourceTag: 'type:api',
  onlyDependOnLibsWithTags: ['type:services', 'type:utils']
};

const TESTING_CONSTRAINT_FIXTURE: DependencyConstraint = {
  sourceTag: 'type:testing',
  onlyDependOnLibsWithTags: ['type:*'],
  notDependOnLibsWithTags: ['type:app', 'type:e2e']
};

const DOMAIN_CONSTRAINT_FIXTURE: DependencyConstraint = {
  sourceTag: 'domain:shared',
  onlyDependOnLibsWithTags: ['domain:shared']
};

const COMBO_CONSTRAINT_FIXTURE: DependencyConstraint = {
  allSourceTags: ['scope:backend', 'type:probe'],
  onlyDependOnLibsWithTags: ['type:utils']
};

const CLOSED_CONSTRAINT_FIXTURE: DependencyConstraint = {
  sourceTag: 'type:closed',
  onlyDependOnLibsWithTags: []
};

const NO_MATCHING_CONSTRAINT_MESSAGE =
  'A project without tags matching at least one constraint cannot depend on any libraries';

/**
 * The message `checkDepConstraints` reports for `message`: the base message after the
 * `source -> target:` header that names the dependency it is about.
 */
const prefixWithEdge = (
  source: ProjectGraphProjectNode,
  target: ProjectGraphProjectNode,
  message: string
): string => `${source.name} -> ${target.name}: ${message}`;

describe('checkDepConstraints', () => {
  const constraints = [
    API_CONSTRAINT_FIXTURE,
    TESTING_CONSTRAINT_FIXTURE,
    DOMAIN_CONSTRAINT_FIXTURE,
    COMBO_CONSTRAINT_FIXTURE,
    CLOSED_CONSTRAINT_FIXTURE
  ];

  describe('the message header', () => {
    it('starts each message with the source and target project names', () => {
      const source = createProjectNodeFixture({ name: 'checkout-api', tags: ['type:api'] });
      const target = createProjectNodeFixture({ name: 'checkout-infra', tags: ['type:infra'] });

      expect(checkDepConstraints(source, target, constraints)).toEqual([
        'checkout-api -> checkout-infra: A project tagged with "type:api" can only depend on libs tagged with "type:services", "type:utils"'
      ]);
    });

    it('puts the header on every message when several rules are broken', () => {
      const source = createProjectNodeFixture({
        name: 'checkout-api',
        tags: ['type:api', 'domain:shared']
      });
      const target = createProjectNodeFixture({
        name: 'checkout-infra',
        tags: ['type:infra', 'domain:checkout']
      });

      const messages = checkDepConstraints(source, target, constraints);

      expect(messages).toHaveLength(2);
      expect(
        messages.every(message => message.startsWith('checkout-api -> checkout-infra: '))
      ).toBe(true);
    });

    it('puts the header on the message for a source that no constraint applies to', () => {
      const source = createProjectNodeFixture({ name: 'bare', tags: [] });
      const target = createProjectNodeFixture({ name: 'checkout-utils', tags: ['type:utils'] });

      expect(checkDepConstraints(source, target, constraints)).toEqual([
        `bare -> checkout-utils: ${NO_MATCHING_CONSTRAINT_MESSAGE}`
      ]);
    });
  });

  describe('with an allowed-tags constraint', () => {
    it('allows a dependency whose target has an allowed tag', () => {
      const source = createProjectNodeFixture({ name: 'api', tags: ['type:api'] });
      const target = createProjectNodeFixture({ name: 'services', tags: ['type:services'] });

      expect(checkDepConstraints(source, target, constraints)).toEqual([]);
    });

    it('needs only one of the allowed tags, not all of them', () => {
      const source = createProjectNodeFixture({ name: 'api', tags: ['type:api'] });
      const target = createProjectNodeFixture({ name: 'utils', tags: ['type:utils'] });

      expect(checkDepConstraints(source, target, constraints)).toEqual([]);
    });

    it('allows a target that has an allowed tag among others', () => {
      const source = createProjectNodeFixture({ name: 'api', tags: ['type:api'] });
      const target = createProjectNodeFixture({
        name: 'mixed',
        tags: ['scope:backend', 'type:services']
      });

      expect(checkDepConstraints(source, target, constraints)).toEqual([]);
    });

    it('reports one message listing every allowed tag when the target has none of them', () => {
      const source = createProjectNodeFixture({ name: 'api', tags: ['type:api'] });
      const target = createProjectNodeFixture({ name: 'infra', tags: ['type:infra'] });

      expect(checkDepConstraints(source, target, constraints)).toEqual([
        prefixWithEdge(
          source,
          target,
          'A project tagged with "type:api" can only depend on libs tagged with "type:services", "type:utils"'
        )
      ]);
    });

    it('reports a target with no tags at all', () => {
      const source = createProjectNodeFixture({ name: 'api', tags: ['type:api'] });
      const target = createProjectNodeFixture({ name: 'bare', tags: [] });

      expect(checkDepConstraints(source, target, constraints)).toHaveLength(1);
    });

    it('treats a target whose tags are undefined as having no tags', () => {
      const source = createProjectNodeFixture({ name: 'api', tags: ['type:api'] });
      const target = createProjectNodeFixture({ name: 'bare' });

      expect(checkDepConstraints(source, target, constraints)).toHaveLength(1);
    });

    it('accepts a wildcard allowed tag', () => {
      const source = createProjectNodeFixture({ name: 'testing', tags: ['type:testing'] });
      const target = createProjectNodeFixture({ name: 'utils', tags: ['type:utils'] });

      expect(checkDepConstraints(source, target, constraints)).toEqual([]);
    });

    it('allows nothing tagged when the allowed list is empty', () => {
      const source = createProjectNodeFixture({ name: 'closed', tags: ['type:closed'] });
      const target = createProjectNodeFixture({ name: 'utils', tags: ['type:utils'] });

      expect(checkDepConstraints(source, target, constraints)).toEqual([
        prefixWithEdge(
          source,
          target,
          'A project tagged with "type:closed" cannot depend on any libs with tags'
        )
      ]);
    });

    it('allows an untagged target when the allowed list is empty', () => {
      const source = createProjectNodeFixture({ name: 'closed', tags: ['type:closed'] });
      const target = createProjectNodeFixture({ name: 'bare', tags: [] });

      expect(checkDepConstraints(source, target, constraints)).toEqual([]);
    });
  });

  describe('with a banned-tags constraint', () => {
    it('reports a target that has a banned tag, even though the allowed tags permit it', () => {
      const source = createProjectNodeFixture({ name: 'testing', tags: ['type:testing'] });
      const target = createProjectNodeFixture({ name: 'app', tags: ['type:app'] });

      expect(checkDepConstraints(source, target, constraints)).toEqual([
        prefixWithEdge(
          source,
          target,
          'A project tagged with "type:testing" can not depend on libs tagged with "type:app"'
        )
      ]);
    });

    it('reports each banned tag the target has', () => {
      const source = createProjectNodeFixture({ name: 'testing', tags: ['type:testing'] });
      const target = createProjectNodeFixture({ name: 'both', tags: ['type:app', 'type:e2e'] });

      expect(checkDepConstraints(source, target, constraints)).toEqual([
        prefixWithEdge(
          source,
          target,
          'A project tagged with "type:testing" can not depend on libs tagged with "type:app"'
        ),
        prefixWithEdge(
          source,
          target,
          'A project tagged with "type:testing" can not depend on libs tagged with "type:e2e"'
        )
      ]);
    });

    it('does not report a target without a banned tag', () => {
      const source = createProjectNodeFixture({ name: 'testing', tags: ['type:testing'] });
      const target = createProjectNodeFixture({ name: 'ui', tags: ['type:ui'] });

      expect(checkDepConstraints(source, target, constraints)).toEqual([]);
    });
  });

  describe('with several constraints', () => {
    it('applies every constraint whose source tag the source has', () => {
      const source = createProjectNodeFixture({ name: 'api', tags: ['type:api', 'domain:shared'] });
      const target = createProjectNodeFixture({
        name: 'infra',
        tags: ['type:infra', 'domain:checkout']
      });

      expect(checkDepConstraints(source, target, constraints)).toEqual([
        prefixWithEdge(
          source,
          target,
          'A project tagged with "type:api" can only depend on libs tagged with "type:services", "type:utils"'
        ),
        prefixWithEdge(
          source,
          target,
          'A project tagged with "domain:shared" can only depend on libs tagged with "domain:shared"'
        )
      ]);
    });

    it('reports only the constraint that is broken', () => {
      const source = createProjectNodeFixture({ name: 'api', tags: ['type:api', 'domain:shared'] });
      const target = createProjectNodeFixture({
        name: 'utils',
        tags: ['type:utils', 'domain:checkout']
      });

      expect(checkDepConstraints(source, target, constraints)).toEqual([
        prefixWithEdge(
          source,
          target,
          'A project tagged with "domain:shared" can only depend on libs tagged with "domain:shared"'
        )
      ]);
    });

    it('ignores constraints whose source tag the source does not have', () => {
      const source = createProjectNodeFixture({ name: 'api', tags: ['type:api'] });
      const target = createProjectNodeFixture({ name: 'app', tags: ['type:app'] });

      expect(checkDepConstraints(source, target, constraints)).toEqual([
        prefixWithEdge(
          source,
          target,
          'A project tagged with "type:api" can only depend on libs tagged with "type:services", "type:utils"'
        )
      ]);
    });

    it('allows a dependency when every applicable constraint is satisfied', () => {
      const source = createProjectNodeFixture({ name: 'api', tags: ['type:api', 'domain:shared'] });
      const target = createProjectNodeFixture({
        name: 'utils',
        tags: ['type:utils', 'domain:shared']
      });

      expect(checkDepConstraints(source, target, constraints)).toEqual([]);
    });
  });

  describe('with a constraint that allows a wildcard domain', () => {
    // The shape of the matrix row that lets an app depend on any domain. Jest cannot load the real
    // matrix (an `.mts` file), so this is a row of the same shape; `check-boundaries` on the real
    // graph exercises the real row.
    const appRow: DependencyConstraint = {
      sourceTag: 'domain:gamers-source',
      onlyDependOnLibsWithTags: ['domain:*']
    };
    const sharedRow: DependencyConstraint = DOMAIN_CONSTRAINT_FIXTURE;
    const app = createProjectNodeFixture({
      name: 'gamers-source-api',
      tags: ['scope:backend', 'type:app', 'domain:gamers-source']
    });

    it.each(['domain:shared', 'domain:gamers-source', 'domain:another-product'])(
      'lets the app depend on a project tagged %s',
      domain => {
        const target = createProjectNodeFixture({ name: 'lib', tags: [domain] });

        expect(checkDepConstraints(app, target, [appRow, sharedRow])).toEqual([]);
      }
    );

    it('still reports an app that depends on a project with no domain tag', () => {
      const target = createProjectNodeFixture({ name: 'lib', tags: ['type:utils'] });

      expect(checkDepConstraints(app, target, [appRow, sharedRow])).toEqual([
        prefixWithEdge(
          app,
          target,
          'A project tagged with "domain:gamers-source" can only depend on libs tagged with "domain:*"'
        )
      ]);
    });

    it('does not apply to a project of another domain', () => {
      const source = createProjectNodeFixture({
        name: 'gamers-source-utils',
        tags: ['type:utils', 'domain:shared']
      });
      const target = createProjectNodeFixture({ name: 'lib', tags: ['domain:gamers-source'] });

      expect(checkDepConstraints(source, target, [appRow, sharedRow])).toEqual([
        prefixWithEdge(
          source,
          target,
          'A project tagged with "domain:shared" can only depend on libs tagged with "domain:shared"'
        )
      ]);
    });
  });

  describe('with a constraint that needs several source tags', () => {
    it('applies it when the source has all of them', () => {
      const source = createProjectNodeFixture({
        name: 'probe',
        tags: ['scope:backend', 'type:probe']
      });
      const target = createProjectNodeFixture({ name: 'api', tags: ['type:api'] });

      expect(checkDepConstraints(source, target, constraints)).toEqual([
        prefixWithEdge(
          source,
          target,
          'A project tagged with "scope:backend" and "type:probe" can only depend on libs tagged with "type:utils"'
        )
      ]);
    });

    it('allows a target that satisfies it', () => {
      const source = createProjectNodeFixture({
        name: 'probe',
        tags: ['scope:backend', 'type:probe']
      });
      const target = createProjectNodeFixture({ name: 'utils', tags: ['type:utils'] });

      expect(checkDepConstraints(source, target, constraints)).toEqual([]);
    });

    it('does not apply it when the source has only some of the tags', () => {
      const source = createProjectNodeFixture({ name: 'probe', tags: ['type:probe'] });
      const target = createProjectNodeFixture({ name: 'api', tags: ['type:api'] });

      expect(checkDepConstraints(source, target, constraints)).toEqual([
        prefixWithEdge(source, target, NO_MATCHING_CONSTRAINT_MESSAGE)
      ]);
    });
  });

  describe('with a wildcard source tag', () => {
    const wildcardConstraints: DependencyConstraint[] = [
      { sourceTag: 'type:*', onlyDependOnLibsWithTags: ['type:utils'] }
    ];

    it('applies it to any source with a matching tag', () => {
      const target = createProjectNodeFixture({ name: 'ui', tags: ['type:ui'] });

      expect(
        checkDepConstraints(
          createProjectNodeFixture({ name: 'a', tags: ['type:api'] }),
          target,
          wildcardConstraints
        )
      ).toHaveLength(1);
      expect(
        checkDepConstraints(
          createProjectNodeFixture({ name: 'b', tags: ['type:ui'] }),
          target,
          wildcardConstraints
        )
      ).toHaveLength(1);
    });

    it('does not apply it to a source without a matching tag', () => {
      const source = createProjectNodeFixture({ name: 'a', tags: ['scope:backend'] });
      const target = createProjectNodeFixture({ name: 'ui', tags: ['type:ui'] });

      expect(checkDepConstraints(source, target, wildcardConstraints)).toEqual([
        prefixWithEdge(source, target, NO_MATCHING_CONSTRAINT_MESSAGE)
      ]);
    });
  });

  describe('when no constraint applies to the source', () => {
    it('reports a source with no tags', () => {
      const source = createProjectNodeFixture({ name: 'bare', tags: [] });
      const target = createProjectNodeFixture({ name: 'utils', tags: ['type:utils'] });

      expect(checkDepConstraints(source, target, constraints)).toEqual([
        prefixWithEdge(source, target, NO_MATCHING_CONSTRAINT_MESSAGE)
      ]);
    });

    it('treats a source whose tags are undefined as having no tags', () => {
      const source = createProjectNodeFixture({ name: 'bare' });
      const target = createProjectNodeFixture({ name: 'utils', tags: ['type:utils'] });

      expect(checkDepConstraints(source, target, constraints)).toEqual([
        prefixWithEdge(source, target, NO_MATCHING_CONSTRAINT_MESSAGE)
      ]);
    });

    it('reports a source whose tags match no constraint', () => {
      const source = createProjectNodeFixture({ name: 'other', tags: ['npm:private'] });
      const target = createProjectNodeFixture({ name: 'utils', tags: ['type:utils'] });

      expect(checkDepConstraints(source, target, constraints)).toEqual([
        prefixWithEdge(source, target, NO_MATCHING_CONSTRAINT_MESSAGE)
      ]);
    });

    it('reports every source when there are no constraints at all', () => {
      const source = createProjectNodeFixture({ name: 'api', tags: ['type:api'] });
      const target = createProjectNodeFixture({ name: 'utils', tags: ['type:utils'] });

      expect(checkDepConstraints(source, target, [])).toEqual([
        prefixWithEdge(source, target, NO_MATCHING_CONSTRAINT_MESSAGE)
      ]);
    });

    it('does not report it when some constraint applies, even if the dependency is allowed', () => {
      const source = createProjectNodeFixture({ name: 'api', tags: ['type:api'] });
      const target = createProjectNodeFixture({ name: 'utils', tags: ['type:utils'] });

      expect(checkDepConstraints(source, target, constraints)).not.toContain(
        prefixWithEdge(source, target, NO_MATCHING_CONSTRAINT_MESSAGE)
      );
    });
  });
});

describe('checkExpectedTagsViolations', () => {
  it('returns nothing when the target has one of the expected tags', () => {
    expect(checkExpectedTagsViolations('type:api', ['type:services'], ['type:services'])).toEqual(
      []
    );
  });

  it('returns nothing when the target has one expected tag out of several', () => {
    expect(
      checkExpectedTagsViolations('type:api', ['type:utils'], ['type:services', 'type:utils'])
    ).toEqual([]);
  });

  it('returns one message naming every expected tag when the target has none', () => {
    expect(
      checkExpectedTagsViolations('type:api', ['type:infra'], ['type:services', 'type:utils'])
    ).toEqual([
      'A project tagged with "type:api" can only depend on libs tagged with "type:services", "type:utils"'
    ]);
  });

  it('matches a wildcard expected tag', () => {
    expect(checkExpectedTagsViolations('type:testing', ['type:ui'], ['type:*'])).toEqual([]);
    expect(checkExpectedTagsViolations('type:testing', ['scope:tools'], ['type:*'])).toHaveLength(
      1
    );
  });

  it('reports a target with no tags when something is expected', () => {
    expect(checkExpectedTagsViolations('type:api', [], ['type:services'])).toHaveLength(1);
  });

  it('allows nothing tagged when no tags are expected', () => {
    expect(checkExpectedTagsViolations('type:closed', ['type:utils'], [])).toEqual([
      'A project tagged with "type:closed" cannot depend on any libs with tags'
    ]);
    expect(checkExpectedTagsViolations('type:closed', [], [])).toEqual([]);
  });

  it('puts the given source tag label in the message', () => {
    const [message] = checkExpectedTagsViolations('scope:backend" and "type:probe', [], ['type:a']);

    expect(message).toBe(
      'A project tagged with "scope:backend" and "type:probe" can only depend on libs tagged with "type:a"'
    );
  });
});

describe('checkBannedTagsViolations', () => {
  it('returns nothing when the target has no banned tag', () => {
    expect(checkBannedTagsViolations('type:testing', ['type:ui'], ['type:app'])).toEqual([]);
  });

  it('returns nothing when there are no banned tags', () => {
    expect(checkBannedTagsViolations('type:testing', ['type:app'], [])).toEqual([]);
  });

  it('returns a message for a banned tag the target has', () => {
    expect(checkBannedTagsViolations('type:testing', ['type:app'], ['type:app'])).toEqual([
      'A project tagged with "type:testing" can not depend on libs tagged with "type:app"'
    ]);
  });

  it('returns one message per banned tag the target has', () => {
    expect(
      checkBannedTagsViolations('type:testing', ['type:app', 'type:e2e'], ['type:app', 'type:e2e'])
    ).toHaveLength(2);
  });

  it('reports only the banned tags the target has', () => {
    expect(
      checkBannedTagsViolations('type:testing', ['type:e2e'], ['type:app', 'type:e2e'])
    ).toEqual([
      'A project tagged with "type:testing" can not depend on libs tagged with "type:e2e"'
    ]);
  });

  it('matches a wildcard banned tag against the target tags', () => {
    expect(checkBannedTagsViolations('scope:tools', ['type:ui'], ['type:*'])).toHaveLength(1);
    expect(checkBannedTagsViolations('scope:tools', ['scope:tools'], ['type:*'])).toEqual([]);
  });

  it('returns nothing for a target with no tags', () => {
    expect(checkBannedTagsViolations('type:testing', [], ['type:app'])).toEqual([]);
  });
});

describe('isComboSrcTagConstraint', () => {
  it('is true for a constraint with several source tags', () => {
    expect(isComboSrcTagConstraint(COMBO_CONSTRAINT_FIXTURE)).toBe(true);
  });

  it('is false for a constraint with one source tag', () => {
    expect(isComboSrcTagConstraint(API_CONSTRAINT_FIXTURE)).toBe(false);
  });
});

describe('isSingleSrcTagConstraint', () => {
  it('is true for a constraint with one source tag', () => {
    expect(isSingleSrcTagConstraint(API_CONSTRAINT_FIXTURE)).toBe(true);
  });

  it('is false for a constraint with several source tags', () => {
    expect(isSingleSrcTagConstraint(COMBO_CONSTRAINT_FIXTURE)).toBe(false);
  });
});

describe('DEP_CONSTRAINTS_PATH', () => {
  it('is the path of the matrix module, next to the constraint code', () => {
    expect(basename(DEP_CONSTRAINTS_PATH)).toBe('nx-dep-constraints.const.mts');
  });

  it('is a file that exists, so renaming or moving the matrix module fails here', () => {
    expect(existsSync(DEP_CONSTRAINTS_PATH)).toBe(true);
  });
});

describe('loadDepConstraints', () => {
  afterEach(() => {
    jest.dontMock(DEP_CONSTRAINTS_PATH);
    jest.resetModules();
  });

  it('returns the matrix that the matrix module exports', () => {
    // Jest cannot load the real `.mts` module, so it is replaced for the call.
    jest.doMock(DEP_CONSTRAINTS_PATH, () => ({
      DEP_CONSTRAINTS: [API_CONSTRAINT_FIXTURE, TESTING_CONSTRAINT_FIXTURE]
    }));

    expect(loadDepConstraints()).toEqual([API_CONSTRAINT_FIXTURE, TESTING_CONSTRAINT_FIXTURE]);
  });

  it('loads the module from DEP_CONSTRAINTS_PATH', () => {
    const factory = jest.fn(() => ({ DEP_CONSTRAINTS: [] }));
    jest.doMock(DEP_CONSTRAINTS_PATH, factory);

    loadDepConstraints();

    expect(factory).toHaveBeenCalledTimes(1);
  });
});
