import { runGh } from './github-cli.utils';

/**
 * Returns the stored token of the given `gh` account without switching the
 * active account. Rejects when that account is not logged in on this machine.
 */
export async function getGithubAccountToken(user: string): Promise<string> {
  const { stdout } = await runGh(['auth', 'token', '--user', user]);

  return stdout.trim();
}

/**
 * Returns the login of the account the `gh` CLI is authenticated as: the active
 * account, or the owner of `token` when one is given.
 *
 * Passes `--jq` a filter with no string literals (Windows PowerShell strips
 * embedded double quotes from native-program arguments).
 */
export async function getGithubAuthenticatedUser(token?: string): Promise<string> {
  const { stdout } = await runGh(['api', 'user', '--jq', '.login'], { token });

  return stdout.trim();
}
