import { execFile } from 'node:child_process';

/** Result of a `gh` invocation. */
interface GithubResult {
  readonly stderr: string;
  readonly stdout: string;
}

/** Options for a `gh` invocation. */
export interface RunGhOptions {
  /**
   * Authenticate this one call with the given token (via `GH_TOKEN`) instead of
   * the active `gh` account. Never placed in the args, so it cannot leak into
   * error messages.
   */
  readonly token?: string;
}

/**
 * Runs the `gh` CLI with the given arguments, resolving with its captured
 * output. Rejects (preserving `gh`'s stderr) when `gh` exits non-zero or is not
 * installed, so callers can surface an actionable error.
 *
 * Uses `execFile` (no shell) so user-controlled arguments such as the PR title
 * cannot be interpreted by a shell.
 */
export function runGh(args: readonly string[], options: RunGhOptions = {}): Promise<GithubResult> {
  return new Promise<GithubResult>((resolve, reject) => {
    const callback = (error: Error | null, stdout: string, stderr: string): void => {
      if (error) {
        const detail = stderr.trim() || error.message;
        reject(new Error(`\`gh ${args.join(' ')}\` failed: ${detail}`, { cause: error }));
        return;
      }

      resolve({ stderr, stdout });
    };

    if (options.token) {
      execFile('gh', [...args], { env: { ...process.env, GH_TOKEN: options.token } }, callback);
    } else {
      execFile('gh', [...args], callback);
    }
  });
}
