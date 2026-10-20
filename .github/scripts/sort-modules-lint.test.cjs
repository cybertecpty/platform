// Pins how `perfectionist/sort-modules` behaves as configured in the root eslint.config.mjs
// (conventions §8 declaration order, ADR 0008 2026-10-20 amendment): what it reports and what
// `--fix` produces. It tests our config (the groups), not the plugin's own sorting, dependency
// and barrier behavior; perfectionist's suite covers that. It lints code strings in memory
// rather than a fixture file, because a deliberately misordered file on disk would fail
// `nx lint` for everyone. It lives here because `node --test` runs this folder in CI and
// `pnpm verify`; the root eslint config belongs to no Nx project that could host a Jest spec.

const assert = require('node:assert/strict');
const { before, describe, it } = require('node:test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const { Linter } = require('eslint');
const tseslint = require('typescript-eslint');

const RULE = 'perfectionist/sort-modules';

let config;

before(async () => {
  // The config is ESM and this file is CJS, hence the dynamic import.
  const root = await import(pathToFileURL(path.resolve(__dirname, '../../eslint.config.mjs')).href);
  // Take the block that carries the rule, so the tests exercise the real options rather than a copy.
  const block = root.default.find(entry => entry.rules?.[RULE]);
  assert.ok(block, `eslint.config.mjs has no ${RULE} block`);
  // The block has no parser of its own (the typed-linting blocks supply it), so add the TS one.
  config = [{ languageOptions: { parser: tseslint.parser } }, block];
});

// `filename` must match the block's `files` glob (`**/*.ts`) for the rule to apply.
const lint = code => new Linter().verify(code, config, { filename: 'src/example.ts' });
// Applies fixes until stable, like `eslint --fix`; the result is in `.output`.
const fix = code => new Linter().verifyAndFix(code, config, { filename: 'src/example.ts' });
// Top-level declaration names in source order, so tests can assert order without comparing
// whole strings. Only needs to understand the declaration forms the fixtures use.
const order = code =>
  [
    ...code.matchAll(
      /^(?:export )?(?:declare )?(?:abstract )?(?:interface|type|enum|class|function) (\w+)/gm
    )
  ].map(m => m[1]);

describe('perfectionist/sort-modules as configured in eslint.config.mjs', () => {
  // Import and export order belongs to prettier-plugin-organize-imports; a perfectionist
  // import/export sorter anywhere in the config would fight it.
  it('is the only perfectionist rule enabled, leaving import and export order to the formatter', async () => {
    const root = await import(
      pathToFileURL(path.resolve(__dirname, '../../eslint.config.mjs')).href
    );
    const enabled = root.default
      .flatMap(entry => Object.entries(entry.rules ?? {}))
      .filter(([name, setting]) => name.startsWith('perfectionist/') && setting !== 'off')
      .map(([name]) => name);

    assert.deepEqual([...new Set(enabled)], [RULE]);
  });

  it('puts classes after types and before functions', () => {
    const code = [
      'export function run() {}',
      'class Box {}',
      'interface Options { a: number }',
      ''
    ].join('\n');

    assert.deepEqual(order(fix(code).output), ['Options', 'Box', 'run']);
  });

  it('reports runtime declarations above type declarations and fixes them', () => {
    const code = [
      'function run(): Options { return { a: 1 }; }',
      'interface Options { a: number }',
      ''
    ].join('\n');

    assert.deepEqual(
      lint(code).map(m => m.ruleId),
      [RULE]
    );
    assert.deepEqual(order(fix(code).output), ['Options', 'run']);
  });

  it('alphabetizes within a group, with enums, interfaces and types sharing one group', () => {
    const code = [
      'type Zeta = string;',
      'interface Mid { a: number }',
      'enum Alpha { A = "a" }',
      ''
    ].join('\n');

    assert.deepEqual(order(fix(code).output), ['Alpha', 'Mid', 'Zeta']);
  });

  it('puts exported functions before private helpers', () => {
    const code = ['function alpha() {}', 'export function zeta() { alpha(); }', ''].join('\n');

    assert.deepEqual(order(fix(code).output), ['zeta', 'alpha']);
  });

  it('accepts the documented order', () => {
    const code = [
      'type Id = string;',
      'interface Options { a: number }',
      'class Box {}',
      'export function run() {}',
      'function helper() {}',
      ''
    ].join('\n');

    assert.deepEqual(lint(code), []);
  });
});
