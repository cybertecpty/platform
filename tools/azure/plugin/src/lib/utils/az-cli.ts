import { runCommand, type RunCommandOptions } from '@cybertecpty/nx-utils';
import type { Except } from 'type-fest';

export const DEFAULT_NOT_FOUND_HINT =
  'Check if the Azure CLI is installed and available on your PATH.';

export type AzCommandOptions = Except<RunCommandOptions, 'command'>;

/**
 * Run the Azure CLI non-interactively and report whether it exited with code 0.
 * When `az` is not on PATH, the logged error carries `notFoundHint`, which defaults
 * to a PATH check.
 */
export async function az(opts: AzCommandOptions): Promise<{ success: boolean }> {
  const notFoundHint = opts.notFoundHint ?? DEFAULT_NOT_FOUND_HINT;

  return await runCommand({ ...opts, command: 'az', notFoundHint });
}
