import simpleGit, { type SimpleGit } from 'simple-git';

/**
 * A single commit returned from a git log query.
 */
export interface GitLogEntry {
  /** Workspace-relative paths of the files the commit touched. */
  readonly files: readonly string[];
  /** Full commit hash. */
  readonly hash: string;
  /** Commit subject line. */
  readonly message: string;
}

/**
 * Options for the simple-git revparse task.
 */
export interface GitRevParseOpts {
  /**
   * Abbreviate the hash to this many characters (passed through to
   * `git rev-parse --short=<n>`). Git lengthens it further when needed to keep
   * the abbreviation unique, and clamps values below its minimum of 4.
   */
  readonly length?: number;
}

/**
 * Lists the Git commits reachable from `to` but not from `from` (the `from..to`
 * range), newest first, including the files each commit touched.
 *
 * Merge commits are excluded: they carry no file diff of their own, and the
 * work they merge is already represented by their constituent commits in the
 * range.
 *
 * @param from The exclusive lower bound of the range (e.g. a base branch).
 * @param to The inclusive upper bound of the range (e.g. a release branch).
 * @returns The commits in the range, newest first.
 */
export async function gitCommitsBetween(
  from: string,
  to: string,
  git: SimpleGit = simpleGit()
): Promise<readonly GitLogEntry[]> {
  // symmetric: false yields the asymmetric `from..to` range instead of
  // simple-git's default symmetric-difference `from...to`. --name-status makes
  // simple-git parse machine-readable paths: unlike --stat, renames resolve to
  // the clean post-rename path rather than a `dir/{old => new}` brace string.
  const log = await git.log({
    from,
    to,
    symmetric: false,
    '--no-merges': null,
    '--name-status': null
  });

  return log.all.map(({ diff, hash, message }) => ({
    files: diff?.files.map(file => file.file) ?? [],
    hash,
    message
  }));
}

/**
 * Gets the hash of the commit at `HEAD` (the most recent commit on the current
 * branch, or the checked-out commit when `HEAD` is detached).
 *
 * @param opts Abbreviation options for the rev-parse command.
 * @returns The full `HEAD` commit hash, or its abbreviation when `opts.length` is set.
 */
export async function lastGitCommitHash(
  opts: GitRevParseOpts = {},
  git: SimpleGit = simpleGit()
): Promise<string> {
  const taskOpts = opts.length ? [`--short=${opts.length}`] : [];

  return (await git.revparse([...taskOpts, 'HEAD'])).trim();
}
