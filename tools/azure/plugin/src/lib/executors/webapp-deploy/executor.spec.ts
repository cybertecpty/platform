import { createExecutorContextFixture } from '@cybertecpty/nx-testing';
import { logger, type ExecutorContext } from '@nx/devkit';
import { vi } from 'vitest';
import { assertAzLoggedIn } from '../../utils/az-cli-auth.utils';
import { az } from '../../utils/az-cli.utils';
import webappDeployExecutor from './executor';
import type { WebappDeployExecutorOptions } from './schema';

vi.mock('../../utils/az-cli-auth.utils', () => ({ assertAzLoggedIn: vi.fn() }));
vi.mock('../../utils/az-cli.utils', () => ({ az: vi.fn() }));

const assertAzLoggedInMock = vi.mocked(assertAzLoggedIn);
const azMock = vi.mocked(az);

const createContextFixture = (overrides: Partial<ExecutorContext> = {}): ExecutorContext =>
  createExecutorContextFixture({ projectName: 'my-app', projectRoot: 'apps/my-app' }, overrides);

describe('webappDeployExecutor', () => {
  const options: WebappDeployExecutorOptions = {
    name: 'my-web-app',
    resourceGroup: 'my-resource-group',
    srcPath: 'dist/apps/my-app/app.zip',
    subscription: 'my-subscription'
  };

  beforeEach(() => {
    assertAzLoggedInMock.mockReset().mockResolvedValue(undefined);
    azMock.mockReset().mockResolvedValue({ success: true });
    vi.spyOn(logger, 'info').mockImplementation(() => undefined);
    vi.spyOn(logger, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deploys with `az webapp deploy` from the workspace root', async () => {
    await expect(webappDeployExecutor(options, createContextFixture())).resolves.toEqual({
      success: true
    });

    expect(azMock).toHaveBeenCalledExactlyOnceWith({
      args: [
        'webapp',
        'deploy',
        '--subscription',
        'my-subscription',
        '--resource-group',
        'my-resource-group',
        '--name',
        'my-web-app',
        '--src-path',
        'dist/apps/my-app/app.zip'
      ],
      cwd: '/workspace'
    });
  });

  it('reports a failed deploy', async () => {
    azMock.mockResolvedValue({ success: false });

    await expect(webappDeployExecutor(options, createContextFixture())).resolves.toEqual({
      success: false
    });
  });

  it('fails without calling az when the Azure CLI has no session', async () => {
    assertAzLoggedInMock.mockRejectedValue(new Error('Not signed in to Azure.'));

    await expect(webappDeployExecutor(options, createContextFixture())).resolves.toEqual({
      success: false
    });

    expect(logger.error).toHaveBeenCalledWith('Not signed in to Azure.');
    expect(azMock).not.toHaveBeenCalled();
  });

  it('logs a thrown non-Error value as text', async () => {
    assertAzLoggedInMock.mockRejectedValue('boom');

    await webappDeployExecutor(options, createContextFixture());

    expect(logger.error).toHaveBeenCalledWith('boom');
  });

  it('fails outside a project target without checking the session', async () => {
    await expect(
      webappDeployExecutor(options, createContextFixture({ projectName: undefined }))
    ).resolves.toEqual({ success: false });

    expect(logger.error).toHaveBeenCalledWith('webapp-deploy must run as a project target.');
    expect(assertAzLoggedInMock).not.toHaveBeenCalled();
    expect(azMock).not.toHaveBeenCalled();
  });
});
