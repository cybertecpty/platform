const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { afterEach, beforeEach, describe, it } = require('node:test');

const { findViolations } = require('./shared-lib-types.cjs');

const REPO_ROOT = path.resolve(__dirname, '../..');

let root;

const write = (rel, value) => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
};

const addProject = (dir, { tags, types, libConfig, targets = { typecheck: {} } }) => {
  write(`${dir}/project.json`, { name: path.basename(dir), tags, targets });
  if (libConfig !== null) {
    write(
      `${dir}/tsconfig.lib.json`,
      libConfig ?? { compilerOptions: types === undefined ? {} : { types }, include: [] }
    );
  }
};

describe('findViolations', () => {
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'shared-lib-types-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('passes a scope:shared lib whose lib tsconfig has no node types', () => {
    addProject('libs/shared/a', { tags: ['scope:shared'], types: ['jest'] });
    addProject('libs/shared/b', { tags: ['scope:shared'], types: [] });

    assert.deepEqual(findViolations(root), []);
  });

  it('flags a scope:shared lib whose lib tsconfig lists node', () => {
    addProject('libs/shared/a', { tags: ['scope:shared'], types: ['jest', 'node'] });

    assert.deepEqual(findViolations(root), [
      { project: 'libs/shared/a', problem: 'tsconfig.lib.json loads "node" types' }
    ]);
  });

  it('flags node types inherited through extends', () => {
    write('tsconfig.base.json', { compilerOptions: { types: ['node'] } });
    addProject('libs/shared/a', {
      tags: ['scope:shared'],
      libConfig: { extends: '../../../tsconfig.base.json', include: [] }
    });

    assert.deepEqual(findViolations(root), [
      { project: 'libs/shared/a', problem: 'tsconfig.lib.json loads "node" types' }
    ]);
  });

  it('flags a lib tsconfig with no types list, which loads every @types package', () => {
    addProject('libs/shared/a', { tags: ['scope:shared'] });

    assert.deepEqual(findViolations(root), [
      {
        project: 'libs/shared/a',
        problem: 'tsconfig.lib.json sets no "types", so every @types package (node too) loads'
      }
    ]);
  });

  it('flags a scope:shared lib with no lib tsconfig', () => {
    addProject('libs/shared/a', { tags: ['scope:shared'], libConfig: null });

    assert.deepEqual(findViolations(root), [
      { project: 'libs/shared/a', problem: 'has no tsconfig.lib.json' }
    ]);
  });

  it('flags a scope:shared lib with no typecheck target, since nothing would check its source', () => {
    addProject('libs/shared/a', { tags: ['scope:shared'], types: [], targets: {} });

    assert.deepEqual(findViolations(root), [
      { project: 'libs/shared/a', problem: 'has no "typecheck" target' }
    ]);
  });

  it('reports a lib tsconfig that TypeScript cannot parse cleanly', () => {
    addProject('libs/shared/a', {
      tags: ['scope:shared'],
      libConfig: { extends: './missing.json', compilerOptions: { types: [] }, include: [] }
    });

    const [violation] = findViolations(root);
    assert.equal(violation.project, 'libs/shared/a');
    assert.match(violation.problem, /^tsconfig\.lib\.json has errors: .*missing\.json/);
  });

  it('ignores projects not tagged scope:shared, and node_modules', () => {
    addProject('tools/a', { tags: ['scope:node'], types: ['node'] });
    addProject('node_modules/pkg', { tags: ['scope:shared'], types: ['node'] });

    assert.deepEqual(findViolations(root), []);
  });
});

describe('scope:shared libs in this workspace', () => {
  it('load no node types in their lib tsconfig', () => {
    assert.deepEqual(findViolations(REPO_ROOT), []);
  });
});
