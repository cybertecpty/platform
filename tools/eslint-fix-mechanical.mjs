// Pre-commit ESLint runner (lint-staged): applies autofixes for mechanical rules only and
// reports everything else. A mechanical fix cannot change what the code does (ordering,
// import style, redundant syntax). Rules not listed here are reported and fail the commit,
// so the author decides: their fixers can change behaviour, e.g. `unicorn/new-for-builtins`
// turns a `Date()` call into `new Date()`, and `@typescript-eslint/no-unnecessary-type-assertion`
// trusts types that may be wrong. `reportUnusedDisableDirectives` fixes carry no rule id, so
// they are never applied here either.
import { ESLint } from 'eslint';

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

const eslint = new ESLint({
  fix: message => message.ruleId !== null && MECHANICAL_RULES.has(message.ruleId),
  warnIgnored: false
});

const results = await eslint.lintFiles(process.argv.slice(2));
await ESLint.outputFixes(results);

const output = await (await eslint.loadFormatter('stylish')).format(results);
if (output) {
  console.log(output);
}

process.exitCode = results.some(result => result.errorCount > 0) ? 1 : 0;
