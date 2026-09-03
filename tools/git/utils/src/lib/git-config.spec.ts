import type { SimpleGit } from 'simple-git';

import { gitLocalUserEmail, gitLocalUserName } from './git-config';

const fakeGit = (value: string | null): SimpleGit =>
  ({
    getConfig: jest.fn(() => Promise.resolve({ value }))
  }) as unknown as SimpleGit;

describe('gitLocalUserName', () => {
  it('returns the configured local user.name', async () => {
    await expect(gitLocalUserName(fakeGit('Ada Lovelace'))).resolves.toBe('Ada Lovelace');
  });

  it('returns an empty string when user.name is unset', async () => {
    await expect(gitLocalUserName(fakeGit(null))).resolves.toBe('');
  });
});

describe('gitLocalUserEmail', () => {
  it('returns the configured local user.email', async () => {
    await expect(gitLocalUserEmail(fakeGit('ada@example.test'))).resolves.toBe('ada@example.test');
  });

  it('returns an empty string when user.email is unset', async () => {
    await expect(gitLocalUserEmail(fakeGit(null))).resolves.toBe('');
  });
});
