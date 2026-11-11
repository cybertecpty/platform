export interface SetupSwaGeneratorOptions {
  /**
   * The name of the app project to be configured
   */
  project: string;
  /**
   * The workspace-relative folder to deploy. Defaults to the output the build target declares, resolved by the swa-deploy executor
   */
  outputPath?: string;
  /**
   * Skip formatting files
   */
  skipFormat?: boolean;
}
