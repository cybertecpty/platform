import { runGh } from './github-cli.utils';
import { getAuthenticatedUser } from './user.utils';

jest.mock('./github-cli.utils', () => ({ runGh: jest.fn() }));

const mockRunGh = jest.mocked(runGh);

afterEach(() => {
  mockRunGh.mockReset();
});

describe('getAuthenticatedUser', () => {
  it('returns the trimmed login reported by `gh api user`', async () => {
    mockRunGh.mockResolvedValue({ stderr: '', stdout: 'cybertec-bot\n' });

    await expect(getAuthenticatedUser()).resolves.toBe('cybertec-bot');
    expect(mockRunGh).toHaveBeenCalledWith(['api', 'user', '--jq', '.login']);
  });

  it('propagates a `gh` failure', async () => {
    mockRunGh.mockRejectedValue(new Error('gh failed'));

    await expect(getAuthenticatedUser()).rejects.toThrow('gh failed');
  });
});
