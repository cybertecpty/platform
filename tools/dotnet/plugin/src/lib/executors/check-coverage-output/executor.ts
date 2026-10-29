import { logger, type PromiseExecutor } from '@nx/devkit';
import { COVERAGE_OUTPUT } from '../../plugin/plugin';
import type { CheckCoverageOutputExecutorOptions } from './schema';

/**
 * Fails when the `test` target of the run project, as resolved in the project graph, does not
 * list the coverage report among its outputs.
 *
 * Without that output a cache hit restores no report, so the project passes the coverage gate
 * but drops out of the PR coverage comment. It also fails, with a logged error, when it runs
 * without a project name.
 */
const checkCoverageOutputExecutor: PromiseExecutor<CheckCoverageOutputExecutorOptions> = (
  _options,
  context
) => {
  const projectName = context.projectName;
  if (!projectName) {
    logger.error('Cannot check the coverage output without a project name.');
    return Promise.resolve({ success: false });
  }

  const outputs = context.projectGraph.nodes[projectName]?.data.targets?.['test']?.outputs;
  if (!outputs?.includes(COVERAGE_OUTPUT)) {
    logger.error(`${projectName}: "test" target outputs do not include ${COVERAGE_OUTPUT}`);
    return Promise.resolve({ success: false });
  }

  return Promise.resolve({ success: true });
};

export default checkCoverageOutputExecutor;
