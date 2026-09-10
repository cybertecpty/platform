import { execFile } from 'node:child_process';

import { runGh } from './github-cli.utils';

jest.mock('node:child_process', () => ({ execFile: jest.fn() }));

type ExecFileCallback = (error: Error | null, stdout: string, stderr: string) => void;

const mockExecFile = jest.mocked(execFile);

/**
 * Stubs the mocked `execFile` with a callback-style implementation, hiding the
 * cast needed to satisfy `execFile`'s overloaded signature.
 */
const whenGhRuns = (impl: (args: readonly string[], callback: ExecFileCallback) => void): void => {
  mockExecFile.mockImplementation(((
    _file: string,
    args: readonly string[],
    callback: ExecFileCallback
  ) => {
    impl(args, callback);

    return undefined as unknown as ReturnType<typeof execFile>;
  }) as typeof execFile);
};

describe('runGh', () => {
  afterEach(() => {
    mockExecFile.mockReset();
  });

  it('invokes the gh binary directly (no shell) with the given args', async () => {
    whenGhRuns((_args, callback) => callback(null, '', ''));

    await runGh(['pr', 'view', '123']);

    expect(mockExecFile).toHaveBeenCalledTimes(1);
    expect(mockExecFile).toHaveBeenCalledWith('gh', ['pr', 'view', '123'], expect.any(Function));
  });

  it('passes a defensive copy of the args, not the caller-owned array', async () => {
    let received: readonly string[] | undefined;
    whenGhRuns((args, callback) => {
      received = args;
      callback(null, '', '');
    });
    const args = ['auth', 'status'];

    await runGh(args);

    expect(received).toEqual(args);
    expect(received).not.toBe(args);
  });

  it('resolves with the captured stdout and stderr on success', async () => {
    whenGhRuns((_args, callback) => callback(null, 'the output\n', 'a warning'));

    await expect(runGh(['auth', 'status'])).resolves.toEqual({
      stdout: 'the output\n',
      stderr: 'a warning'
    });
  });

  it('rejects with gh stderr when gh exits non-zero, keeping the original error as cause', async () => {
    const failure = Object.assign(new Error('Command failed'), { code: 1 });
    whenGhRuns((_args, callback) => callback(failure, '', 'pull request already exists\n'));

    await expect(runGh(['pr', 'create'])).rejects.toThrow(
      '`gh pr create` failed: pull request already exists'
    );
    await expect(runGh(['pr', 'create'])).rejects.toHaveProperty('cause', failure);
  });

  it('falls back to the error message when gh produced no stderr (e.g. not installed)', async () => {
    const failure = Object.assign(new Error('spawn gh ENOENT'), { code: 'ENOENT' });
    whenGhRuns((_args, callback) => callback(failure, '', ''));

    await expect(runGh(['pr', 'list'])).rejects.toThrow('`gh pr list` failed: spawn gh ENOENT');
  });
});
