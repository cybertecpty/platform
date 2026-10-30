import { createGitRepoFixture, type GitRepoFixture } from '@cybertecpty/git-testing';
import { isAncestorCommit } from './git-commits';

describe('isAncestorCommit (real git)', () => {
  let repo: GitRepoFixture;
  let root: string;
  let tip: string;

  beforeEach(async () => {
    repo = await createGitRepoFixture();
    root = await repo.commit('root');
    tip = await repo.commit('tip');
  });

  afterEach(() => {
    repo.cleanup();
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
