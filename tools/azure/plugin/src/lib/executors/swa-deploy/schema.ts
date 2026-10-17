/**
 * Options for the `swa-deploy` executor. Keep in step with `schema.json`.
 */
export interface SwaDeployExecutorOptions {
  /**
   * Folder to deploy, relative to the workspace root. Defaults to the single output the
   * build target declares; the deploy fails if it declares none or several.
   */
  outputPath?: string;

  /**
   * Target whose declared output is deployed when `outputPath` isn't set. Defaults to
   * `build`.
   */
  buildTarget?: string;

  /**
   * Static Web Apps environment to deploy to. Defaults to `production`; any other name
   * deploys a preview environment.
   */
  env?: string;
}
