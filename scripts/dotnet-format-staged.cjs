// Pre-commit `dotnet format` runner (lint-staged): rewrites the staged C# files to the formatting
// `dotnet format` expects. lint-staged passes absolute paths and `dotnet format --include`
// silently ignores an absolute Windows path (exit 0, nothing rewritten), so they become
// repo-relative first.
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const WORKSPACE = 'Platform.slnx';
const REPO_ROOT = path.resolve(__dirname, '..');

function toRepoRelative(files, root = REPO_ROOT) {
  return files.map(file => path.relative(root, path.resolve(root, file)).split(path.sep).join('/'));
}

function main(files) {
  if (files.length === 0) {
    return 0;
  }

  const result = spawnSync('dotnet', ['format', WORKSPACE, '--include', ...toRepoRelative(files)], {
    cwd: REPO_ROOT,
    stdio: 'inherit'
  });

  return result.status ?? 1;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = { toRepoRelative };
