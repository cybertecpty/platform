// The module under test is CommonJS so bare `node` can load it, which leaves it untyped here.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- see comment above
const { isMechanicalFix } = require('./mechanical-rules.cjs') as {
  isMechanicalFix: (message: { ruleId: string | null }) => boolean;
};

describe('isMechanicalFix', () => {
  it('allows a mechanical rule', () => {
    expect(isMechanicalFix({ ruleId: 'perfectionist/sort-modules' })).toBe(true);
  });

  it('rejects a rule whose fixer can change behaviour', () => {
    expect(isMechanicalFix({ ruleId: 'unicorn/new-for-builtins' })).toBe(false);
  });

  it('rejects a fix with no rule id, such as an unused disable directive', () => {
    expect(isMechanicalFix({ ruleId: null })).toBe(false);
  });
});
