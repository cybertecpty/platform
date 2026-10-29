const assert = require('node:assert/strict');
const path = require('node:path');
const { describe, it } = require('node:test');

const { findViolations, loadNodes } = require('./dotnet-coverage-output.cjs');

const REPO_ROOT = path.resolve(__dirname, '../..');
const COVERAGE = '{workspaceRoot}/coverage/{projectRoot}';

const node = ({ tags = ['type:testing'], technologies = ['dotnet'], outputs }) => ({
  tags,
  metadata: { technologies },
  targets: { test: { outputs } }
});

describe('findViolations', () => {
  it('passes a tests project that caches the coverage report', () => {
    assert.deepEqual(
      findViolations({ a: node({ outputs: ['{projectRoot}/TestResults', COVERAGE] }) }),
      []
    );
  });

  it('flags a tests project whose test outputs omit the coverage report', () => {
    assert.deepEqual(findViolations({ a: node({ outputs: ['{projectRoot}/TestResults'] }) }), [
      { project: 'a', problem: `"test" target outputs do not include ${COVERAGE}` }
    ]);
  });

  it('flags a tests project with no test outputs at all', () => {
    assert.equal(findViolations({ a: node({ outputs: undefined }) }).length, 1);
  });

  it('ignores .NET projects that are not tests projects', () => {
    assert.deepEqual(findViolations({ a: node({ tags: ['type:feature'], outputs: [] }) }), []);
  });

  it('ignores tests projects that are not .NET projects', () => {
    assert.deepEqual(findViolations({ a: node({ technologies: ['jest'], outputs: [] }) }), []);
  });
});

describe('the workspace', () => {
  it('caches the coverage report of every .NET tests project', () => {
    assert.deepEqual(findViolations(loadNodes(REPO_ROOT)), []);
  });
});
