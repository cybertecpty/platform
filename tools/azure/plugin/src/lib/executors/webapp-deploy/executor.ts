import { logger, type PromiseExecutor } from '@nx/devkit';
import { assertAzLoggedIn } from '../../utils/az-cli-auth.utils';
import { az } from '../../utils/az-cli.utils';
import type { WebappDeployExecutorOptions } from './schema';

/**
 * Deploy a build artifact to an Azure Web App with `az webapp deploy`.
 *
 * Fails before calling `az` when run outside a project target or when the Azure CLI has no
 * usable session. It never logs in: sign in with `az login` locally, or the `azure/login`
 * step in CI. The subscription is always passed, so the deploy never lands in whichever
 * subscription happens to be the CLI default.
 */
const webappDeployExecutor: PromiseExecutor<WebappDeployExecutorOptions> = async (
  { name, resourceGroup, srcPath, subscription },
  context
) => {
  if (!context.projectName) {
    logger.error('webapp-deploy must run as a project target.');
    return { success: false };
  }

  try {
    await assertAzLoggedIn();
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    return { success: false };
  }

  return az({
    args: [
      'webapp',
      'deploy',
      '--subscription',
      subscription,
      '--resource-group',
      resourceGroup,
      '--name',
      name,
      '--src-path',
      srcPath
    ],
    // `srcPath` is relative to the workspace root, not to wherever Nx was started.
    cwd: context.root
  });
};

export default webappDeployExecutor;
