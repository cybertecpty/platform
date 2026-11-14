/**
 * The library types a frontend project may have: the shared types plus the Angular ones.
 */
export type FrontendLibType =
  SharedLibType | Extract<NxProjectLibType, 'core' | 'data-access' | 'feature' | 'ui'>;

/**
 * Union of all valid Nx project library types.
 */
export type NxProjectLibType =
  | 'api'
  | 'core'
  | 'data-access'
  | 'feature'
  | 'infra'
  | 'plugin'
  | 'services'
  | 'testing'
  | 'types'
  | 'ui'
  | 'utils';

/**
 * The library types that are platform-polymorphic: the same type can be scoped to
 * any platform.
 */
export type SharedLibType = Extract<NxProjectLibType, 'testing' | 'utils'>;
