// Rules whose autofix cannot change what the code does (ordering, import style, redundant
// syntax). Everything else is reported but never rewritten: their fixers can change
// behaviour, e.g. `unicorn/new-for-builtins` turns a `Date()` call into `new Date()`, and
// `@typescript-eslint/no-unnecessary-type-assertion` trusts types that may be wrong.
const MECHANICAL_RULES = new Set([
  '@typescript-eslint/consistent-type-imports',
  '@typescript-eslint/no-duplicate-type-constituents',
  '@typescript-eslint/no-empty-interface',
  '@typescript-eslint/no-extra-non-null-assertion',
  '@typescript-eslint/no-import-type-side-effects',
  '@typescript-eslint/no-inferrable-types',
  '@typescript-eslint/prefer-as-const',
  '@typescript-eslint/prefer-namespace-keyword',
  'no-extra-boolean-cast',
  'no-regex-spaces',
  'no-unused-labels',
  'perfectionist/sort-modules',
  'prefer-const',
  'unicorn/prefer-node-protocol'
]);

// `reportUnusedDisableDirectives` fixes carry a null rule id, so they are never applied.
function isMechanicalFix(message) {
  return message.ruleId !== null && MECHANICAL_RULES.has(message.ruleId);
}

module.exports = { MECHANICAL_RULES, isMechanicalFix };
