/**
 * Whether the current Nx invocation is a dry run.
 *
 * Read from `NX_DRY_RUN` rather than a generator option on purpose: `nx generate`
 * mirrors `--dry-run` into this env var in yargs middleware, then strips `dryRun`
 * from the options object the generator receives — so inside a generator body the
 * env var is the only supported signal. `nx release` sets it the same way for
 * `preVersionCommand` hooks and publish executors.
 *
 * Any value other than the exact string `"true"` (including the `"false"` /
 * `"undefined"` the middleware writes when the flag is absent) is treated as off.
 */
export function dryRunEnabled(): boolean {
  return process.env['NX_DRY_RUN'] === 'true';
}

/**
 * Whether Nx verbose logging is enabled.
 *
 * Nx sets `NX_VERBOSE_LOGGING` to `"true"` whenever a command runs with
 * `--verbose`, so this is a reliable signal from anywhere in a generator,
 * executor, or task process. Any other value is treated as off.
 */
export function verboseEnabled(): boolean {
  return process.env['NX_VERBOSE_LOGGING'] === 'true';
}
