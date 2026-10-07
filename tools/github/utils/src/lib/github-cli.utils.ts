import { execFile } from 'node:child_process';

/** Result of a `gh` invocation. */
interface GithubResult {
  readonly stderr: string;
  readonly stdout: string;
}

/**
 * Runs the `gh` CLI with the given arguments, resolving with its captured
 * output. Rejects (preserving `gh`'s stderr) when `gh` exits non-zero or is not
 * installed, so callers can surface an actionable error.
 *
 * Uses `execFile` (no shell) so user-controlled arguments such as the PR title
 * cannot be interpreted by a shell.
 */
export function runGh(args: readonly string[]): Promise<GithubResult> {
  return new Promise<GithubResult>((resolve, reject) => {
    execFile('gh', [...args], (error, stdout, stderr) => {
      if (error) {
        const detail = stderr.trim() || error.message;
        reject(new Error(`\`gh ${args.join(' ')}\` failed: ${detail}`, { cause: error }));
        return;
      }

      resolve({ stderr, stdout });
    });
  });
}
