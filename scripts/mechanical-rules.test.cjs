const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { isMechanicalFix } = require('./mechanical-rules.cjs');

describe('isMechanicalFix', () => {
  it('allows a mechanical rule', () => {
    assert.equal(isMechanicalFix({ ruleId: 'perfectionist/sort-modules' }), true);
  });

  it('rejects a rule whose fixer can change behaviour', () => {
    assert.equal(isMechanicalFix({ ruleId: 'unicorn/new-for-builtins' }), false);
  });

  it('rejects a fix with no rule id, such as an unused disable directive', () => {
    assert.equal(isMechanicalFix({ ruleId: null }), false);
  });
});
