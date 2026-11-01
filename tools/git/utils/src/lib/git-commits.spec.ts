import { createGitRepoFixture, type GitRepoFixture } from '@cybertecpty/git-testing';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  gitCommitsBetween,
  gitMergeBase,
  isAncestorCommit,
  lastGitCommitHash
} from './git-commits';

let repo: GitRepoFixture;

beforeEach(async () => {
  repo = await createGitRepoFixture();
});

afterEach(() => {
  repo.cleanup();
});

/** Commits a file with the given name, so the commit touches a path. */
const commitFile = async (file: string, message: string): Promise<string> => {
  writeFileSync(join(repo.dir, file), message);
  await repo.git.add(file);
  await repo.git.commit(message);

  return (await repo.git.revparse(['HEAD'])).trim();
};

describe('gitCommitsBetween', () => {
  it('lists the commits after `from` up to `to`, newest first, with the paths each touched', async () => {
    const base = await repo.commit('base');
    const first = await commitFile('a.ts', 'feat: a');
    const second = await commitFile('b.ts', 'feat: b');

    await expect(gitCommitsBetween(base, 'HEAD', repo.git)).resolves.toEqual([
      { hash: second, message: 'feat: b', files: ['b.ts'] },
      { hash: first, message: 'feat: a', files: ['a.ts'] }
    ]);
  });

  it('excludes the `from` commit and everything before it', async () => {
    await commitFile('a.ts', 'feat: a');
    const base = await commitFile('b.ts', 'feat: b');

    await expect(gitCommitsBetween(base, 'HEAD', repo.git)).resolves.toEqual([]);
  });

  it('excludes merge commits but keeps the commits they merged', async () => {
    const base = await repo.commit('base');
    await repo.git.checkoutBranch('feature', base);
    const featureCommit = await commitFile('f.ts', 'feat: feature');
    await repo.git.checkout('main');
    await repo.git.raw(['merge', '--no-ff', '-m', 'merge feature', 'feature']);

    const commits = await gitCommitsBetween(base, 'HEAD', repo.git);

    expect(commits.map(commit => commit.hash)).toEqual([featureCommit]);
  });

  it('yields an empty file list for a commit that touches no paths', async () => {
    const base = await repo.commit('base');
    const empty = await repo.commit('chore: empty');

    await expect(gitCommitsBetween(base, 'HEAD', repo.git)).resolves.toEqual([
      { hash: empty, message: 'chore: empty', files: [] }
    ]);
  });
});

describe('gitCommitsBetween without a lower bound', () => {
  it('lists every commit reachable from `to`', async () => {
    const first = await commitFile('a.ts', 'feat: a');
    const second = await commitFile('b.ts', 'feat: b');

    await expect(gitCommitsBetween(null, 'HEAD', repo.git)).resolves.toEqual([
      { hash: second, message: 'feat: b', files: ['b.ts'] },
      { hash: first, message: 'feat: a', files: ['a.ts'] }
    ]);
  });
});

describe('gitMergeBase', () => {
  it('returns the commit two diverged branches share', async () => {
    const base = await repo.commit('base');
    await repo.commit('main work');
    await repo.git.checkoutBranch('feature', base);
    await repo.commit('feature work');

    await expect(gitMergeBase('main', 'feature', repo.git)).resolves.toBe(base);
  });

  it('returns null when the histories share no commit', async () => {
    await repo.commit('base');
    await repo.git.raw(['checkout', '--orphan', 'orphan']);
    await repo.commit('unrelated root');

    await expect(gitMergeBase('main', 'orphan', repo.git)).resolves.toBeNull();
  });

  it('returns null when a revision does not exist', async () => {
    await repo.commit('base');

    await expect(gitMergeBase('main', 'does-not-exist', repo.git)).resolves.toBeNull();
  });
});

describe('isAncestorCommit', () => {
  let root: string;
  let tip: string;

  beforeEach(async () => {
    root = await repo.commit('root');
    tip = await repo.commit('tip');
  });

  it('is true for an earlier commit on the same line of history', async () => {
    await expect(isAncestorCommit(root, tip, repo.git)).resolves.toBe(true);
  });

  it('is false for a later commit asked against an earlier one', async () => {
    await expect(isAncestorCommit(tip, root, repo.git)).resolves.toBe(false);
  });

  it('is true for a commit and itself', async () => {
    await expect(isAncestorCommit(tip, tip, repo.git)).resolves.toBe(true);
  });

  it('accepts branch names as well as hashes', async () => {
    await expect(isAncestorCommit(root, 'main', repo.git)).resolves.toBe(true);
  });

  it('is false for a commit on a diverged branch', async () => {
    await repo.git.checkoutBranch('feature', root);
    const featureCommit = await repo.commit('feature work');

    await expect(isAncestorCommit(featureCommit, 'main', repo.git)).resolves.toBe(false);
    await expect(isAncestorCommit(tip, 'feature', repo.git)).resolves.toBe(false);
  });

  it('is true once the diverged branch has been merged', async () => {
    await repo.git.checkoutBranch('feature', root);
    const featureCommit = await repo.commit('feature work');

    await repo.git.checkout('main');
    await repo.git.raw(['merge', '--no-ff', '-m', 'merge feature', 'feature']);

    await expect(isAncestorCommit(featureCommit, 'main', repo.git)).resolves.toBe(true);
  });

  it('throws on an unknown revision instead of answering', async () => {
    await expect(isAncestorCommit('does-not-exist', tip, repo.git)).rejects.toThrow();
    await expect(isAncestorCommit(root, 'does-not-exist', repo.git)).rejects.toThrow();
  });
});

describe('lastGitCommitHash', () => {
  it('returns the full hash of HEAD', async () => {
    const head = await repo.commit('base');

    await expect(lastGitCommitHash({}, repo.git)).resolves.toBe(head);
  });

  it('abbreviates the hash when a length is requested', async () => {
    const head = await repo.commit('base');
    const short = await lastGitCommitHash({ length: 7 }, repo.git);

    expect(short.length).toBeGreaterThanOrEqual(7);
    expect(short.length).toBeLessThan(head.length);
    expect(head.startsWith(short)).toBe(true);
  });
});

describe('default git client', () => {
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    process.chdir(repo.dir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
  });

  it('works on the repository in the current directory when no client is passed', async () => {
    const base = await repo.commit('base');
    const next = await commitFile('a.ts', 'feat: a');

    await expect(lastGitCommitHash()).resolves.toBe(next);
    await expect(gitMergeBase('main', 'HEAD')).resolves.toBe(next);
    await expect(isAncestorCommit(base, 'HEAD')).resolves.toBe(true);
    await expect(gitCommitsBetween(base, 'HEAD')).resolves.toHaveLength(1);
  });
});
