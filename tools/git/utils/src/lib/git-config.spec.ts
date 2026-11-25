import { createGitRepoFixture, type GitRepoFixture } from '@cybertecpty/git-testing';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { vi } from 'vitest';
import { gitLocalUserEmail, gitLocalUserName } from './git-config';

let repo: GitRepoFixture;
let globalConfigDir: string;

describe('git-config', () => {
  beforeEach(async () => {
    repo = await createGitRepoFixture();
    // A global identity the local config must not be confused with.
    globalConfigDir = mkdtempSync(join(tmpdir(), 'git-global-config-'));
    const globalConfig = join(globalConfigDir, 'gitconfig');
    writeFileSync(globalConfig, '[user]\n\tname = Global Name\n\temail = global@example.test\n');
    vi.stubEnv('GIT_CONFIG_GLOBAL', globalConfig);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(globalConfigDir, { force: true, recursive: true });
    repo.cleanup();
  });

  describe('gitLocalUserName', () => {
    it('returns the local user.name', async () => {
      await repo.git.raw(['config', '--local', 'user.name', 'Ada Lovelace']);

      await expect(gitLocalUserName(repo.git)).resolves.toBe('Ada Lovelace');
    });

    it('returns an empty string when user.name is only set globally', async () => {
      await repo.git.raw(['config', '--local', '--unset', 'user.name']);

      await expect(gitLocalUserName(repo.git)).resolves.toBe('');
    });
  });

  describe('gitLocalUserEmail', () => {
    it('returns the local user.email', async () => {
      await repo.git.raw(['config', '--local', 'user.email', 'ada@example.test']);

      await expect(gitLocalUserEmail(repo.git)).resolves.toBe('ada@example.test');
    });

    it('returns an empty string when user.email is only set globally', async () => {
      await repo.git.raw(['config', '--local', '--unset', 'user.email']);

      await expect(gitLocalUserEmail(repo.git)).resolves.toBe('');
    });
  });

  describe('default git client', () => {
    it('works on the repository in the current directory when no client is passed', async () => {
      const originalCwd = process.cwd();
      await repo.git.raw(['config', '--local', 'user.name', 'Ada Lovelace']);
      await repo.git.raw(['config', '--local', 'user.email', 'ada@example.test']);
      process.chdir(repo.dir);

      try {
        await expect(gitLocalUserName()).resolves.toBe('Ada Lovelace');
        await expect(gitLocalUserEmail()).resolves.toBe('ada@example.test');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });
});
