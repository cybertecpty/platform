import { az } from './az-cli.utils';

/**
 * Fail unless the Azure CLI has a usable session.
 *
 * Only checks: it never logs in, because an interactive login hangs CI and a
 * service-principal login would put the secret on the command line. A missing
 * CLI also reads as "not signed in"; `runCommand` has already logged the
 * not-found hint by then.
 *
 * @throws When the session is missing or expired, or the CLI can't be run.
 */
export async function assertAzLoggedIn(): Promise<void> {
  if (!(await isAzLoggedIn())) {
    throw new Error(
      'Not signed in to Azure (or the session has expired), or the Azure CLI is not available. Run az login locally, or add an azure/login step in CI.'
    );
  }
}

/**
 * Whether the CLI can get an access token. Unlike `az account show`, this
 * refreshes the token, so an expired session counts as signed out.
 */
async function isAzLoggedIn(): Promise<boolean> {
  return (await az({ args: ['account', 'get-access-token'], stdio: 'ignore' })).success;
}
