const assert = require('node:assert/strict');
const path = require('node:path');
const { describe, it } = require('node:test');

const REPO_ROOT = path.resolve(__dirname, '../..');

// Nx's own source-tag and tag-pattern matching, the code `@nx/enforce-module-boundaries` runs. The
// package does not export it, so it is loaded by path.
const nxLintUtils = require(
  path.join(
    path.dirname(require.resolve('@nx/eslint-plugin/package.json', { paths: [REPO_ROOT] })),
    'dist/src/utils/runtime-lint-utils.js'
  )
);

// Node strips the types of the matrix module itself, as it does for `eslint.config.mjs`.
const { DEP_CONSTRAINTS } = require(
  path.join(REPO_ROOT, 'tools/nx/utils/src/lib/nx-dep-constraints.const.mts')
);

const projectNode = tags => ({ name: 'probe', type: 'app', data: { tags } });

/**
 * Whether the rule lets a project with `sourceTags` depend on a project with `targetTags`, on the
 * `domain:` axis: every matching constraint that lists `domain:` tags must have one the target has.
 */
const domainEdgeAllowed = (sourceTags, targetTags) =>
  nxLintUtils
    .findConstraintsFor(DEP_CONSTRAINTS, projectNode(sourceTags))
    .filter(constraint =>
      constraint.onlyDependOnLibsWithTags?.some(tag => tag.startsWith('domain:'))
    )
    .every(constraint =>
      constraint.onlyDependOnLibsWithTags.some(
        tag =>
          nxLintUtils.findConstraintsFor([{ sourceTag: tag }], projectNode(targetTags)).length > 0
      )
    );

const APP_TAGS = ['scope:backend', 'type:app', 'domain:gamers-source'];

describe('the gamers-source app row of the dependency constraints', () => {
  it('lets the app depend on a project of any domain', () => {
    for (const domain of ['domain:shared', 'domain:gamers-source', 'domain:another-product']) {
      assert.equal(domainEdgeAllowed(APP_TAGS, [domain]), true, domain);
    }
  });

  it('applies to the app and to no other project', () => {
    const rows = tags =>
      nxLintUtils
        .findConstraintsFor(DEP_CONSTRAINTS, projectNode(tags))
        .filter(constraint => constraint.onlyDependOnLibsWithTags?.includes('domain:*'));

    assert.equal(rows(APP_TAGS).length, 1);
    assert.equal(rows(['scope:backend', 'type:app', 'domain:shared']).length, 0);
    assert.equal(rows(['scope:backend', 'type:services', 'domain:gamers-source']).length, 0);
  });

  it('keeps a gamers-source lib to its own domain and domain:shared', () => {
    const services = ['scope:backend', 'type:services', 'domain:gamers-source'];

    assert.equal(domainEdgeAllowed(services, ['domain:gamers-source']), true);
    assert.equal(domainEdgeAllowed(services, ['domain:shared']), true);
    assert.equal(domainEdgeAllowed(services, ['domain:another-product']), false);
  });

  it('keeps a gamers-source tests project to its own domain and domain:shared', () => {
    const tests = ['scope:backend', 'type:testing', 'domain:gamers-source'];

    assert.equal(domainEdgeAllowed(tests, ['domain:gamers-source']), true);
    assert.equal(domainEdgeAllowed(tests, ['domain:another-product']), false);
  });

  it('leaves domain:shared projects unable to depend on a product domain', () => {
    const shared = ['scope:backend', 'type:utils', 'domain:shared'];

    assert.equal(domainEdgeAllowed(shared, ['domain:shared']), true);
    assert.equal(domainEdgeAllowed(shared, ['domain:gamers-source']), false);
  });
});
