import { createExecutorContextFixture } from '@cybertecpty/nx-testing';
import { logger, type ProjectGraph } from '@nx/devkit';
import { COVERAGE_OUTPUT } from '../../plugin/plugin';
import checkCoverageOutputExecutor from './executor';

const graphWithTestOutputs = (outputs: string[] | undefined): ProjectGraph =>
  ({
    nodes: {
      'checkout-tests': {
        name: 'checkout-tests',
        type: 'lib',
        data: { root: 'tests', targets: { test: { outputs } } }
      }
    },
    dependencies: {}
  }) as unknown as ProjectGraph;

const run = (outputs: string[] | undefined, projectName: string | undefined = 'checkout-tests') =>
  checkCoverageOutputExecutor(
    {},
    createExecutorContextFixture(
      { projectName, projectRoot: 'tests' },
      { projectGraph: graphWithTestOutputs(outputs) }
    )
  );

describe('checkCoverageOutputExecutor', () => {
  beforeEach(() => {
    jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  });

  it('passes when the test target caches the coverage report', async () => {
    await expect(run(['{projectRoot}/TestResults', COVERAGE_OUTPUT])).resolves.toEqual({
      success: true
    });
  });

  it('fails, naming the project, when the coverage report is not an output', async () => {
    await expect(run(['{projectRoot}/TestResults'])).resolves.toEqual({ success: false });
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('checkout-tests'));
  });

  it('fails when the test target has no outputs', async () => {
    await expect(run(undefined)).resolves.toEqual({ success: false });
  });

  it('fails without a project name', async () => {
    await expect(run([COVERAGE_OUTPUT], null as unknown as undefined)).resolves.toEqual({
      success: false
    });
  });
});
