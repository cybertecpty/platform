import type * as NxUtils from '@cybertecpty/nx-utils';
import { runCommand } from '@cybertecpty/nx-utils';
import { vi } from 'vitest';
import { az, DEFAULT_NOT_FOUND_HINT } from './az-cli.utils';

vi.mock('@cybertecpty/nx-utils', async () => ({
  ...(await vi.importActual<typeof NxUtils>('@cybertecpty/nx-utils')),
  runCommand: vi.fn()
}));

const runCommandMock = vi.mocked(runCommand);

describe('az', () => {
  beforeEach(() => {
    runCommandMock.mockReset();
    runCommandMock.mockResolvedValue({ success: true });
  });

  it('runs the az command with the given options and the default not-found hint', async () => {
    await az({ args: ['account', 'show'], cwd: '/workspace', stdio: 'ignore' });

    expect(runCommandMock).toHaveBeenCalledWith({
      command: 'az',
      args: ['account', 'show'],
      cwd: '/workspace',
      stdio: 'ignore',
      notFoundHint: DEFAULT_NOT_FOUND_HINT
    });
  });

  it('keeps a caller-supplied not-found hint', async () => {
    await az({ args: ['--version'], notFoundHint: 'Install it from example.com.' });

    expect(runCommandMock).toHaveBeenCalledWith(
      expect.objectContaining({ notFoundHint: 'Install it from example.com.' })
    );
  });

  it('keeps an explicitly empty not-found hint instead of replacing it', async () => {
    await az({ args: ['--version'], notFoundHint: '' });

    expect(runCommandMock).toHaveBeenCalledWith(expect.objectContaining({ notFoundHint: '' }));
  });

  it('does not let options override the command', async () => {
    await az({ args: ['--version'], command: 'other' } as Parameters<typeof az>[0]);

    expect(runCommandMock).toHaveBeenCalledWith(expect.objectContaining({ command: 'az' }));
  });

  it('returns the result of the command', async () => {
    runCommandMock.mockResolvedValue({ success: false });

    await expect(az({ args: ['account', 'show'] })).resolves.toEqual({ success: false });
  });
});
