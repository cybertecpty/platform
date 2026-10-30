import { existsSync } from 'node:fs';

import { createGitRepoFixture } from './git-repo.fixture';

describe('createGitRepoFixture', () => {
  it('creates a repository on main with a usable local identity', async () => {
    const repo = await createGitRepoFixture();

    try {
      const hash = await repo.commit('first');

      expect(hash).toMatch(/^[0-9a-f]{40}$/);
      expect((await repo.git.revparse(['--abbrev-ref', 'HEAD'])).trim()).toBe('main');
      expect((await repo.git.raw(['log', '-1', '--format=%an'])).trim()).toBe('Fixture');
    } finally {
      repo.cleanup();
    }
  });

  it('returns a different hash for each commit', async () => {
    const repo = await createGitRepoFixture();

    try {
      const first = await repo.commit('first');
      const second = await repo.commit('second');

      expect(second).not.toBe(first);
      expect((await repo.git.revparse(['HEAD'])).trim()).toBe(second);
    } finally {
      repo.cleanup();
    }
  });

  it('removes the repository from disk on cleanup', async () => {
    const repo = await createGitRepoFixture();

    expect(existsSync(repo.dir)).toBe(true);

    repo.cleanup();

    expect(existsSync(repo.dir)).toBe(false);
  });

  it('gives each fixture its own directory', async () => {
    const a = await createGitRepoFixture();
    const b = await createGitRepoFixture();

    try {
      expect(a.dir).not.toBe(b.dir);
    } finally {
      a.cleanup();
      b.cleanup();
    }
  });
});
