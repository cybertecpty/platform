import { resolveTargetOutputFolder, runCommand } from '@cybertecpty/nx-utils';
import { logger, type ExecutorContext, type PromiseExecutor } from '@nx/devkit';
import { join } from 'node:path';
import type { SwaDeployExecutorSchema } from './schema';

export const TOKEN_VARIABLE = 'SWA_CLI_DEPLOYMENT_TOKEN';

const DEFAULT_BUILD_TARGET = 'build';

const missingTokenMessage = (projectRoot: string): string =>
  [
    `${TOKEN_VARIABLE} is not set, so the deploy was not attempted.`,
    `For a local deploy, copy ${projectRoot}/.env.deploy.example to ${projectRoot}/.env.deploy`,
    `and set the token from the Azure portal (Static Web App > Manage deployment token).`,
    `In CI, it comes from the AZURE_STATIC_WEB_APPS_API_TOKEN secret of the project's GitHub Environment.`
  ].join('\n');

type OutputPathResult = { outputPath: string } | { error: string };

/**
 * Resolve the folder to deploy: the `outputPath` option, else the single output the
 * build target declares. There is no `dist/` fallback: a guessed folder either deploys
 * the wrong thing or fails inside `swa` with an unclear error.
 */
const resolveOutputPath = (
  options: SwaDeployExecutorSchema,
  context: ExecutorContext,
  projectName: string
): OutputPathResult => {
  if (options.outputPath) {
    return { outputPath: options.outputPath };
  }

  const buildTarget = options.buildTarget ?? DEFAULT_BUILD_TARGET;

  try {
    return {
      outputPath: resolveTargetOutputFolder(context.projectGraph, projectName, buildTarget)
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return { error: `${message} Set the outputPath option on the deploy target.` };
  }
};

/**
 * Deploy a project's build output to Azure Static Web Apps.
 *
 * Fails before calling the SWA CLI when the deploy folder can't be resolved or the
 * deployment token is missing: without the token, `swa deploy` falls back to an
 * interactive login that offers to create a new Static Web App. The token reaches the
 * CLI through the environment, never as an argument.
 */
const swaDeployExecutor: PromiseExecutor<SwaDeployExecutorSchema> = (options, context) => {
  const projectName = context.projectName;

  if (!projectName) {
    logger.error('swa-deploy must run as a project target.');
    return Promise.resolve({ success: false });
  }

  const resolved = resolveOutputPath(options, context, projectName);

  if ('error' in resolved) {
    logger.error(resolved.error);
    return Promise.resolve({ success: false });
  }

  if (!process.env[TOKEN_VARIABLE]?.trim()) {
    logger.error(missingTokenMessage(context.projectsConfigurations.projects[projectName].root));
    return Promise.resolve({ success: false });
  }

  return runCommand({
    // The root devDependency's bin shim, so the deploy doesn't depend on PATH. An OS path:
    // joinPathFragments would strip the Windows drive letter.
    command: join(context.root, 'node_modules', '.bin', 'swa'),
    args: [
      'deploy',
      resolved.outputPath,
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
