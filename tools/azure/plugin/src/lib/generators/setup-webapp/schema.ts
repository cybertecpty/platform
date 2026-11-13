import type { SetRequired } from 'type-fest';

export type NormalizedSetupWebappGeneratorOptions = SetRequired<
  SetupWebappGeneratorOptions,
  'name' | 'srcPath'
>;

export interface SetupWebappGeneratorOptions {
  /**
   * The name of the app project to be configured
   */
  project: string;
  /**
   * The name of the Azure Web App.  Defaults to the project name.
   */
  name?: string;
  /**
   * The path to the compressed file containing the deploy artifacts.  Defaults to `deploy/{project}.zip`
   */
  srcPath?: string;
  /**
   * Name of the resource group that contains the Web App.
   */
  resourceGroup: string;
  /**
   * Skip formatting files
   */
  skipFormat?: boolean;
  /**
   * Name or ID of the Azure subscription that contains the Web App. Always passed, so the deploy never falls back to the CLI's default subscription.
   */
  subscription: string;
}
