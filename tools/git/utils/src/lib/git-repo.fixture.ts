import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import simpleGit, { type SimpleGit } from 'simple-git';

/**
 * A throwaway git repository for specs that need real git behavior.
 */
export interface GitRepoFixture {
  /** Removes the repository from disk. */
  readonly cleanup: () => void;
  /** Adds an empty commit on the checked-out branch and returns its hash. */
  readonly commit: (message: string) => Promise<string>;
  /** The repository's working directory. */
  readonly dir: string;
  /** A client rooted at {@link GitRepoFixture.dir}. */
  readonly git: SimpleGit;
}

/**
 * Creates an empty repository on branch `main` in a fresh temp directory, with a
 * local identity and signing off so commits and tags work on any machine.
 */
export async function createGitRepoFixture(): Promise<GitRepoFixture> {
  const dir = mkdtempSync(join(tmpdir(), 'git-repo-fixture-'));
  const git = simpleGit(dir);

  await git.raw(['init', '--initial-branch=main']);
  await git.addConfig('user.name', 'Fixture', false, 'local');
  await git.addConfig('user.email', 'fixture@example.com', false, 'local');
  await git.addConfig('commit.gpgsign', 'false', false, 'local');
  await git.addConfig('tag.gpgsign', 'false', false, 'local');

  return {
    cleanup: () => rmSync(dir, { force: true, recursive: true }),
    commit: async message => {
      await git.raw(['commit', '--allow-empty', '-m', message]);

      return (await git.revparse(['HEAD'])).trim();
    },
    dir,
    git
  };
}
