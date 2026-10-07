import { runGh } from './github-cli.utils';

/**
 * Returns the login of the account the `gh` CLI is currently authenticated as.
 *
 * Passes `--jq` a filter with no string literals (Windows PowerShell strips
 * embedded double quotes from native-program arguments).
 */
export async function getAuthenticatedUser(): Promise<string> {
  const { stdout } = await runGh(['api', 'user', '--jq', '.login']);

  return stdout.trim();
}
