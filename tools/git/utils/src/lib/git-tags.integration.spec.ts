import { createGitRepoFixture, type GitRepoFixture } from './git-repo.fixture';
import { gitTagCommit } from './git-tags';

describe('gitTagCommit (real git)', () => {
  let repo: GitRepoFixture;
  let first: string;
  let second: string;

  beforeEach(async () => {
    repo = await createGitRepoFixture();
    first = await repo.commit('first');
    second = await repo.commit('second');
  });

  afterEach(() => {
    repo.cleanup();
  });

  it('returns the commit a lightweight tag points at', async () => {
    await repo.git.raw(['tag', 'app@1.0.0', first]);

    await expect(gitTagCommit('app@1.0.0', repo.git)).resolves.toBe(first);
  });

  it('peels an annotated tag to its commit rather than the tag object', async () => {
    await repo.git.addAnnotatedTag('app@1.1.0', 'app@1.1.0');

    await expect(gitTagCommit('app@1.1.0', repo.git)).resolves.toBe(second);
  });

  it('returns null when no such tag exists', async () => {
    await expect(gitTagCommit('app@9.9.9', repo.git)).resolves.toBeNull();
  });

  it('does not treat a longer tag name as a match for a shorter one', async () => {
    await repo.git.raw(['tag', 'app@1.0.0-rc.1', first]);

    await expect(gitTagCommit('app@1.0.0', repo.git)).resolves.toBeNull();
  });

  it('does not treat a glob character in the name as a pattern', async () => {
    await repo.git.raw(['tag', 'app@1.0.0', first]);

    await expect(gitTagCommit('app@1.*', repo.git)).resolves.toBeNull();
  });
});
