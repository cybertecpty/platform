import { runGh } from './github-cli.utils';
import { getGithubAuthenticatedUser } from './github-user.utils';

jest.mock('./github-cli.utils', () => ({ runGh: jest.fn() }));

const mockRunGh = jest.mocked(runGh);

afterEach(() => {
  mockRunGh.mockReset();
});

describe('getGithubAuthenticatedUser', () => {
  it('returns the trimmed login reported by `gh api user`', async () => {
    mockRunGh.mockResolvedValue({ stderr: '', stdout: 'cybertec-bot\n' });

    await expect(getGithubAuthenticatedUser()).resolves.toBe('cybertec-bot');
    expect(mockRunGh).toHaveBeenCalledWith(['api', 'user', '--jq', '.login']);
  });

  it('propagates a `gh` failure', async () => {
    mockRunGh.mockRejectedValue(new Error('gh failed'));

    await expect(getGithubAuthenticatedUser()).rejects.toThrow('gh failed');
  });
});
