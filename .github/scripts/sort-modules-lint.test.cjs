const assert = require('node:assert/strict');
const { before, describe, it } = require('node:test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const { Linter } = require('eslint');
const tseslint = require('typescript-eslint');

const RULE = 'perfectionist/sort-modules';

let config;

before(async () => {
  const root = await import(pathToFileURL(path.resolve(__dirname, '../../eslint.config.mjs')).href);
  const block = root.default.find(entry => entry.rules?.[RULE]);
  assert.ok(block, `eslint.config.mjs has no ${RULE} block`);
  config = [{ languageOptions: { parser: tseslint.parser } }, block];
});

const lint = code => new Linter().verify(code, config, { filename: 'src/example.ts' });
const fix = code => new Linter().verifyAndFix(code, config, { filename: 'src/example.ts' });
const order = code =>
  [
    ...code.matchAll(
      /^(?:export )?(?:declare )?(?:abstract )?(?:interface|type|enum|class|function|const|let) (\w+)/gm
    )
  ].map(m => m[1]);

describe('perfectionist/sort-modules as configured in eslint.config.mjs', () => {
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

  it('never moves a class above the class or enum it depends on', () => {
    const code = [
      'class Zed {}',
      'class Alpha extends Zed {}',
      'enum Base { A = 1 }',
      'enum Derived { B = Base.A }',
      ''
    ].join('\n');

    const fixed = fix(code).output;
    assert.ok(fixed.indexOf('class Zed') < fixed.indexOf('class Alpha'), fixed);
    assert.ok(fixed.indexOf('enum Base') < fixed.indexOf('enum Derived'), fixed);
  });

  it('leaves const and let declarations in place and never sorts across them', () => {
    const code = [
      'function zeta() {}',
      'const limit = 1;',
      'let state = 0;',
      'export const exported = 2;',
      'interface Late { a: number }',
      ''
    ].join('\n');

    assert.deepEqual(lint(code), []);
    assert.equal(fix(code).output, code);
  });

  it('still sorts the run of declarations after a const', () => {
    const code = ['const limit = 1;', 'function run() {}', 'interface Late { a: number }', ''].join(
      '\n'
    );

    assert.deepEqual(order(fix(code).output), ['limit', 'Late', 'run']);
  });

  it('leaves expression statements and control flow as barriers', () => {
    const code = [
      'function zeta() {}',
      'zeta();',
      'function alpha() {}',
      'if (alpha) { zeta(); }',
      'function beta() {}',
      ''
    ].join('\n');

    assert.deepEqual(order(fix(code).output), ['zeta', 'alpha', 'beta']);
  });
});
