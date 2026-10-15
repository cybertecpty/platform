/**
 * Options for the `swa-deploy` executor.
 */
export interface SwaDeployExecutorSchema {
  /**
   * Folder to deploy, relative to the workspace root. Defaults to the project's build
   * output, `dist/{projectRoot}`.
   */
  outputPath?: string;

  /**
   * Static Web Apps environment to deploy to. Defaults to `production`; any other name
   * deploys a preview environment.
   */
  env?: string;
}
