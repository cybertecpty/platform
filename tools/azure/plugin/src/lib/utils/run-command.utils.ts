import { logger } from '@nx/devkit';
import { spawn } from 'cross-spawn';

export interface RunCommandOptions {
  /** Executable to run, resolved from PATH (`.cmd` shims included on Windows). */
  command: string;

  /** Arguments passed to the command. Each is quoted for the platform's shell. */
  args: readonly string[];

  /** Absolute working directory. */
  cwd: string;

  /** Standard IO mode for the child process. Defaults to `inherit`. */
  stdio?: 'ignore' | 'inherit';

  /** Appended to the error when the command is not on PATH, e.g. an install link. */
  notFoundHint?: string;
}

/**
 * Run a CLI non-interactively and report whether it exited with code 0.
 *
 * Uses cross-spawn so Windows `.cmd` shims (`az.cmd`, `swa.cmd`) run without
 * `shell: true`, whose unquoted argument joining lets `& | ^ %` and spaces
 * rewrite the command. Never rejects: spawn failures are logged and reported
 * as `{ success: false }`, like a non-zero exit.
 *
 * The command line is logged verbatim, so pass credentials through the child's
 * environment, never as args.
 */
export const runCommand = (options: RunCommandOptions): Promise<{ success: boolean }> => {
  const { command, args, cwd, notFoundHint } = options;

  logger.info(`Running "${[command, ...args].join(' ')}" in ${cwd}`);

  return new Promise(resolveExecution => {
    // `error` can be followed by `close`; report only the first outcome.
    let settled = false;
    const settle = (success: boolean): void => {
      if (!settled) {
        settled = true;
        resolveExecution({ success });
      }
    };

    const fail = (error: NodeJS.ErrnoException): void => {
      logger.error(
        error.code === 'ENOENT'
          ? [`"${command}" was not found on PATH.`, notFoundHint].filter(Boolean).join(' ')
          : `Failed to run "${command}": ${error.message}`
      );
      settle(false);
    };

    let childProcess: ReturnType<typeof spawn>;
    try {
      childProcess = spawn(command, [...args], {
        cwd,
        stdio: options.stdio ?? 'inherit',
        windowsHide: true
      });
    } catch (error) {
      // Most spawn failures arrive as an `error` event, but invalid arguments (e.g.
      // EINVAL on Windows) throw synchronously.
      fail(error as NodeJS.ErrnoException);
      return;
    }

    childProcess.on('error', fail);

    childProcess.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
      if (signal) {
        logger.error(`"${command}" was terminated by ${signal}.`);
      }
      settle(code === 0);
    });
  });
};
