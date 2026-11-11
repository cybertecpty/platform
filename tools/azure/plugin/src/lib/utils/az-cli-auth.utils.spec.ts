import { vi } from 'vitest';
import { assertAzLoggedIn } from './az-cli-auth.utils';
import { az } from './az-cli.utils';

vi.mock('./az-cli.utils', () => ({ az: vi.fn() }));

const azMock = vi.mocked(az);

describe('assertAzLoggedIn', () => {
  beforeEach(() => {
    azMock.mockReset();
  });

  it('resolves when the CLI can get an access token', async () => {
    azMock.mockResolvedValue({ success: true });

    await expect(assertAzLoggedIn()).resolves.toBeUndefined();
  });

  it('checks with a quiet `az account get-access-token`', async () => {
    azMock.mockResolvedValue({ success: true });

    await assertAzLoggedIn();

    expect(azMock).toHaveBeenCalledExactlyOnceWith({
      args: ['account', 'get-access-token'],
      stdio: 'ignore'
    });
  });

  it('rejects with sign-in guidance when the check fails', async () => {
    azMock.mockResolvedValue({ success: false });

    await expect(assertAzLoggedIn()).rejects.toThrow(/Not signed in to Azure/);
    await expect(assertAzLoggedIn()).rejects.toThrow(/az login.*azure\/login/);
  });

  it('never runs a login command', async () => {
    azMock.mockResolvedValue({ success: false });

    await assertAzLoggedIn().catch(() => undefined);

    expect(azMock).toHaveBeenCalledTimes(1);
    expect(azMock.mock.calls[0][0].args).not.toContain('login');
  });
});
