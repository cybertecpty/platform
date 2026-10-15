import { logger } from '@nx/devkit';
import type { ChildProcess } from 'child_process';
import { spawn } from 'cross-spawn';
import { EventEmitter } from 'events';
import { runCommand } from './run-command.utils';

jest.mock('cross-spawn', () => ({ spawn: jest.fn() }));

const spawnMock = jest.mocked(spawn);

// Model only the process events runCommand depends on.
const mockChildProcess = (): EventEmitter => {
  const childProcess = new EventEmitter();

  spawnMock.mockReturnValue(childProcess as unknown as ChildProcess);

  return childProcess;
};

const enoent = (): NodeJS.ErrnoException =>
  Object.assign(new Error('spawn az ENOENT'), { code: 'ENOENT' });

describe('runCommand', () => {
  const baseOptions = { command: 'az', args: ['account', 'show'], cwd: '/workspace' };

  beforeEach(() => {
    spawnMock.mockReset();
    jest.spyOn(logger, 'info').mockImplementation(() => undefined);
    jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('spawns the command without a shell and inherits stdio by default', async () => {
    const childProcess = mockChildProcess();

    const execution = runCommand(baseOptions);
    childProcess.emit('close', 0, null);

    await expect(execution).resolves.toEqual({ success: true });
    expect(spawnMock).toHaveBeenCalledWith('az', ['account', 'show'], {
      cwd: '/workspace',
      stdio: 'inherit',
      windowsHide: true
    });
  });

  it('forwards a custom stdio mode', async () => {
    const childProcess = mockChildProcess();

    const execution = runCommand({ ...baseOptions, stdio: 'ignore' });
    childProcess.emit('close', 0, null);

    await execution;
    expect(spawnMock).toHaveBeenCalledWith(
      'az',
      ['account', 'show'],
      expect.objectContaining({ stdio: 'ignore' })
    );
  });

  it('passes args containing shell metacharacters through as single arguments', async () => {
    const childProcess = mockChildProcess();
    const args = ['tag', 'create', '--tags', 'a=1&b=2', 'owner=Jane Doe'];

    const execution = runCommand({ ...baseOptions, args });
    childProcess.emit('close', 0, null);

    await execution;
    const [, spawnedArgs] = spawnMock.mock.calls[0];
    expect(spawnedArgs).toEqual(args);
    expect(spawnedArgs).not.toBe(args);
  });

  it('logs the command and cwd before spawning', async () => {
    const childProcess = mockChildProcess();

    const execution = runCommand(baseOptions);
    childProcess.emit('close', 0, null);

    await execution;
    expect(logger.info).toHaveBeenCalledWith('Running "az account show" in /workspace');
  });

  it('returns an unsuccessful result on a non-zero exit code', async () => {
    const childProcess = mockChildProcess();

    const execution = runCommand(baseOptions);
    childProcess.emit('close', 2, null);

    await expect(execution).resolves.toEqual({ success: false });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('reports the signal when the process is terminated', async () => {
    const childProcess = mockChildProcess();

    const execution = runCommand(baseOptions);
    childProcess.emit('close', null, 'SIGTERM');

    await expect(execution).resolves.toEqual({ success: false });
    expect(logger.error).toHaveBeenCalledWith('"az" was terminated by SIGTERM.');
  });

  it('explains a missing command with the hint, and ignores the close that follows', async () => {
    const childProcess = mockChildProcess();

    const execution = runCommand({ ...baseOptions, notFoundHint: 'Install it.' });
    childProcess.emit('error', enoent());
    childProcess.emit('close', 0, null);

    await expect(execution).resolves.toEqual({ success: false });
    expect(logger.error).toHaveBeenCalledWith('"az" was not found on PATH. Install it.');
  });

  it('explains a missing command without a hint', async () => {
    const childProcess = mockChildProcess();

    const execution = runCommand(baseOptions);
    childProcess.emit('error', enoent());

    await expect(execution).resolves.toEqual({ success: false });
    expect(logger.error).toHaveBeenCalledWith('"az" was not found on PATH.');
  });

  it('reports any other spawn failure', async () => {
    const childProcess = mockChildProcess();

    const execution = runCommand(baseOptions);
    childProcess.emit('error', new Error('spawn EACCES'));

    await expect(execution).resolves.toEqual({ success: false });
    expect(logger.error).toHaveBeenCalledWith('Failed to run "az": spawn EACCES');
  });
});
