import { joinPathFragments, logger, type PromiseExecutor } from '@nx/devkit';
import { join } from 'node:path';
import { runCommand } from '../../utils/run-command.utils';
import type { SwaDeployExecutorSchema } from './schema';

export const TOKEN_VARIABLE = 'SWA_CLI_DEPLOYMENT_TOKEN';

const missingTokenMessage = (projectRoot: string): string =>
  [
    `${TOKEN_VARIABLE} is not set, so the deploy was not attempted.`,
    `For a local deploy, copy ${projectRoot}/.env.deploy.example to ${projectRoot}/.env.deploy`,
    `and set the token from the Azure portal (Static Web App > Manage deployment token).`,
    `In CI, it comes from the AZURE_STATIC_WEB_APPS_API_TOKEN secret of the project's GitHub Environment.`
  ].join('\n');

/**
 * Deploy a project's build output to Azure Static Web Apps.
 *
 * Fails before calling the SWA CLI when the deployment token is missing: without it,
 * `swa deploy` falls back to an interactive login that offers to create a new Static
 * Web App. The token reaches the CLI through the environment, never as an argument.
 */
const swaDeployExecutor: PromiseExecutor<SwaDeployExecutorSchema> = (options, context) => {
  const projectName = context.projectName;

  if (!projectName) {
    logger.error('swa-deploy must run as a project target.');
    return Promise.resolve({ success: false });
  }

  const projectRoot = context.projectsConfigurations.projects[projectName].root;

  if (!process.env[TOKEN_VARIABLE]?.trim()) {
    logger.error(missingTokenMessage(projectRoot));
    return Promise.resolve({ success: false });
  }

  return runCommand({
    // The root devDependency's bin shim, so the deploy doesn't depend on PATH. An OS path:
    // joinPathFragments would strip the Windows drive letter.
    command: join(context.root, 'node_modules', '.bin', 'swa'),
    args: [
      'deploy',
      options.outputPath ?? joinPathFragments('dist', projectRoot),
      '--env',
      options.env ?? 'production',
      '--no-use-keychain'
    ],
    cwd: context.root,
    notFoundHint:
      'Run `pnpm install`: the SWA CLI is the root devDependency @azure/static-web-apps-cli.'
  });
};

export default swaDeployExecutor;
