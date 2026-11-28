import type { SetRequired } from 'type-fest';

export type NormalizedSignalStoreGeneratorOptions = SetRequired<
  SignalStoreGeneratorOptions,
  'addEntities' | 'directory' | 'export' | 'providedInRoot' | 'skipEvents' | 'skipLogger'
>;

export interface SignalStoreGeneratorOptions {
  /**
   * Add entity collection support to the Signal Store with `withEntities`, and an entity type to go with it.
   */
  readonly addEntities?: boolean;
  /**
   * A directory where the Signal Store is placed, relative to the 'lib' folder of the project's source root. If not provided, the Signal Store will be placed in the 'stores' folder.
   */
  readonly directory?: string;
  /**
   * Whether to export the generated file as part of the public API of the project.
   */
  readonly export?: boolean;
  /**
   * Name of the Signal Store.
   */
  readonly name: string;
  /**
   * The name of the project in which to place the Signal Store. Valid for any Angular project type except testing.
   */
  readonly project: string;
  /**
   * If true, the Signal Store will be provided in the root injector. If false, the store will need to be provided manually.
   */
  readonly providedInRoot?: boolean;
  /**
   * Skip adding an event group, created with `eventGroup`, to the Signal Store.
   */
  readonly skipEvents?: boolean;
  /**
   * Skip formatting files.
   */
  readonly skipFormat?: boolean;
  /**
   * Skip adding logger feature to the Signal Store.
   */
  readonly skipLogger?: boolean;
}
