import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runGh } from './github-cli.utils';

/**
 * Options for opening a new release pull request.
 */
export interface CreatePullRequestOptions {
  /** Branch the PR merges into (e.g. `main`). */
  readonly base: string;
  /** Markdown body of the PR. */
  readonly body: string;
  /** Branch the PR merges from (the release branch). */
  readonly head: string;
  /** PR title. */
  readonly title: string;
}

/**
 * Options for updating an existing release pull request.
 */
export interface UpdatePullRequestOptions {
  /** Markdown body of the PR. */
  readonly body: string;
  /** Number of the existing PR to edit. */
  readonly number: number;
  /** PR title. */
  readonly title: string;
}

/** Shape of a single PR record returned by `gh pr list --json number`. */
export interface GithubPullRequestRef {
  readonly number: number;
}

/**
 * Opens a new GitHub pull request via the `gh` CLI.
 *
 * The body is passed through a temp file (`--body-file`) rather than inline so
 * long changelog bodies cannot exceed OS command-line length limits.
 *
 * @returns The URL of the created pull request, as printed by `gh`.
 */
export async function createPullRequest(options: CreatePullRequestOptions): Promise<string> {
  return withPullRequestBodyFile(options.body, async bodyFile => {
    const { stdout } = await runGh([
      'pr',
      'create',
      '--base',
      options.base,
      '--head',
      options.head,
      '--title',
      options.title,
      '--body-file',
      bodyFile
    ]);

    return stdout.trim();
  });
}

/**
 * Finds the first open pull request for the given head → base branch pair.
 *
 * @returns The PR number, or `null` when no open PR exists.
 */
export async function findOpenPullRequest(head: string, base: string): Promise<number | null> {
  const { stdout } = await runGh([
    'pr',
    'list',
    '--head',
    head,
    '--base',
    base,
    '--state',
    'open',
    '--json',
    'number'
  ]);

  const pullRequests = JSON.parse(stdout) as GithubPullRequestRef[];

  return pullRequests[0]?.number ?? null;
}

/**
 * Updates the title and body of an existing GitHub pull request via the `gh` CLI.
 *
 * @returns The URL of the updated pull request, as printed by `gh`.
 */
export async function updatePullRequest(options: UpdatePullRequestOptions): Promise<string> {
  return withPullRequestBodyFile(options.body, async bodyFile => {
    const { stdout } = await runGh([
      'pr',
      'edit',
      String(options.number),
      '--title',
      options.title,
      '--body-file',
      bodyFile
    ]);

    return stdout.trim();
  });
}

/**
 * Writes `body` to a throwaway temp file, invokes `run` with its path, and
 * always removes the temp directory afterward.
 *
 * @returns Whatever `run` resolves with (e.g. the PR URL printed by `gh`).
 */
async function withPullRequestBodyFile<T>(
  body: string,
  run: (bodyFile: string) => Promise<T>
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'release-pr-'));
  const bodyFile = join(dir, 'body.md');

  try {
    await writeFile(bodyFile, body, 'utf8');
    return await run(bodyFile);
  } finally {
    // Best-effort cleanup; never mask the original error if removal fails.
    await rm(dir, { force: true, recursive: true });
  }
}
