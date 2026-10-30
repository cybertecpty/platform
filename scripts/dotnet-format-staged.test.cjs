const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');

const { toRepoRelative } = require('./dotnet-format-staged.cjs');

const SCRIPT = path.join(__dirname, 'dotnet-format-staged.cjs');
const PROJECT_DIR = path.resolve(__dirname, '../libs/gaming-collection/api');

describe('toRepoRelative', () => {
  it('converts an absolute path to a forward-slash repo-relative one', () => {
    const root = path.resolve('repo-root');
    assert.deepEqual(toRepoRelative([path.join(root, 'libs', 'a', 'B.cs')], root), ['libs/a/B.cs']);
  });

  it('keeps a path that is already relative', () => {
    assert.deepEqual(toRepoRelative(['libs/a/B.cs'], path.resolve('repo-root')), ['libs/a/B.cs']);
  });
});

describe('dotnet-format-staged', () => {
  it('rewrites a badly formatted file given by absolute path', () => {
    const file = path.join(PROJECT_DIR, 'BadlyFormattedStaged.cs');
    fs.writeFileSync(file, 'namespace Platform.Tmp;\r\npublic class   BadlyFormattedStaged{}\r\n');
    try {
      const result = spawnSync(process.execPath, [SCRIPT, file], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.equal(
        fs.readFileSync(file, 'utf8'),
        'namespace Platform.Tmp;\n\npublic class BadlyFormattedStaged { }\n'
      );
    } finally {
      fs.rmSync(file, { force: true });
    }
  });

  it('does not run dotnet format when no file is staged', () => {
    const result = spawnSync(process.execPath, [SCRIPT], {
      encoding: 'utf8',
      env: { ...process.env, PATH: '' }
    });
    assert.equal(result.status, 0, result.stderr);
  });
});
