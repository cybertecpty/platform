import { runGh } from './github-cli.utils';
import { getGithubAccountToken, getGithubAuthenticatedUser } from './github-user.utils';

jest.mock('./github-cli.utils', () => ({ runGh: jest.fn() }));

const mockRunGh = jest.mocked(runGh);

afterEach(() => {
  mockRunGh.mockReset();
});

describe('getGithubAuthenticatedUser', () => {
  it('returns the trimmed login reported by `gh api user`', async () => {
    mockRunGh.mockResolvedValue({ stderr: '', stdout: 'cybertec-bot\n' });

    await expect(getGithubAuthenticatedUser()).resolves.toBe('cybertec-bot');
    expect(mockRunGh).toHaveBeenCalledWith(['api', 'user', '--jq', '.login'], {
      token: undefined
    });
  });

  it('asks for the owner of the given token', async () => {
    mockRunGh.mockResolvedValue({ stderr: '', stdout: 'cybertec-bot\n' });

    await getGithubAuthenticatedUser('bot-token');

    expect(mockRunGh).toHaveBeenCalledWith(['api', 'user', '--jq', '.login'], {
      token: 'bot-token'
    });
  });

  it('propagates a `gh` failure', async () => {
    mockRunGh.mockRejectedValue(new Error('gh failed'));

    await expect(getGithubAuthenticatedUser()).rejects.toThrow('gh failed');
  });
});

describe('getGithubAccountToken', () => {
  it('returns the trimmed stored token of the account without switching to it', async () => {
    mockRunGh.mockResolvedValue({ stderr: '', stdout: 'gho_abc\n' });

    await expect(getGithubAccountToken('cybertec-bot')).resolves.toBe('gho_abc');
    expect(mockRunGh).toHaveBeenCalledWith(['auth', 'token', '--user', 'cybertec-bot']);
  });

  it('rejects when the account is not logged in', async () => {
    mockRunGh.mockRejectedValue(new Error('no token found'));

    await expect(getGithubAccountToken('cybertec-bot')).rejects.toThrow('no token found');
  });
});
