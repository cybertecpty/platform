/**
 * Guard for the .NET coverage report cache (issue #245).
 *
 * `@nx/dotnet` infers only `{projectRoot}/TestResults` as an output of `test`, and coverlet
 * writes its report to `coverage/{projectRoot}`. `@cybertecpty/dotnet-plugin` adds that
 * directory to every .NET project tagged `type:testing`, but only if it is merged after
 * `@nx/dotnet`, and the plugin's result can go stale. A tests project that loses the output
 * still passes the 80% gate on a cache hit while dropping out of the PR coverage comment, so
 * this reads the resolved project graph (what Nx actually runs) and reports each such project
 * whose `test` target lacks it.
 *
 * Run by `node --test` (`dotnet-coverage-output.test.cjs`) in `pnpm verify` and CI.
 */

const { execFileSync } = require('node:child_process');

const TAG = 'type:testing';
const COVERAGE_OUTPUT = '{workspaceRoot}/coverage/{projectRoot}';

/**
 * Reports each .NET `type:testing` project whose `test` target does not cache the coverage report.
 * @param {Record<string, { tags?: string[], metadata?: { technologies?: string[] }, targets?: Record<string, { outputs?: string[] }> }>} nodes
 *   the `data` of each project graph node, keyed by project name
 * @returns {{ project: string, problem: string }[]}
 */
function findViolations(nodes) {
  const violations = [];
  for (const [project, data] of Object.entries(nodes)) {
    if (!data.tags?.includes(TAG)) continue;
    if (!data.metadata?.technologies?.includes('dotnet')) continue;

    const outputs = data.targets?.test?.outputs;
    if (!outputs?.includes(COVERAGE_OUTPUT)) {
      violations.push({
        project,
        problem: `"test" target outputs do not include ${COVERAGE_OUTPUT}`
      });
    }
  }
  return violations;
}

/**
 * Loads the resolved project graph of the workspace.
 * @param {string} root workspace root
 * @returns {Record<string, object>} project name -> graph node data
 */
function loadNodes(root) {
  const output = execFileSync('pnpm', ['exec', 'nx', 'graph', '--print'], {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, NX_DAEMON: 'false' }
  });
  const { nodes } = JSON.parse(output.slice(output.indexOf('{'))).graph;
  return Object.fromEntries(Object.entries(nodes).map(([name, node]) => [name, node.data]));
}

module.exports = { findViolations, loadNodes };
