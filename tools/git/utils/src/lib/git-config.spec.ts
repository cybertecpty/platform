import simpleGit, { type SimpleGit } from 'simple-git';

import { gitLocalUserEmail, gitLocalUserName } from './git-config';

jest.mock('simple-git', () => ({ __esModule: true, default: jest.fn() }));

const mockSimpleGit = jest.mocked(simpleGit);

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

describe('default simple-git client', () => {
  afterEach(() => {
    mockSimpleGit.mockReset();
  });

  it('gitLocalUserName falls back to simpleGit() when no client is passed', async () => {
    mockSimpleGit.mockReturnValue(fakeGit('Ada Lovelace'));

    await expect(gitLocalUserName()).resolves.toBe('Ada Lovelace');
    expect(mockSimpleGit).toHaveBeenCalledTimes(1);
  });

  it('gitLocalUserEmail falls back to simpleGit() when no client is passed', async () => {
    mockSimpleGit.mockReturnValue(fakeGit('ada@example.test'));

    await expect(gitLocalUserEmail()).resolves.toBe('ada@example.test');
    expect(mockSimpleGit).toHaveBeenCalledTimes(1);
  });
});
