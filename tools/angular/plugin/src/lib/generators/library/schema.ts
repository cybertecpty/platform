import type {
  FrontendLibType,
  NormalizedNxProjectOptions,
  NxProjectOptions
} from '@cybertecpty/nx-types';
import type { Schema } from '@nx/angular/src/generators/library/schema';
import type { Except, SetRequired, Simplify } from 'type-fest';
import type { NgUnitTestRunner } from '../../types/ng-projects.types';

export type NgLibGeneratorOptions = Simplify<
  // Manual directory overrides are disallowed.  The directory is derived from the project options.
  // `setParserOptionsProject` is excluded because it is handled by `enableTypedLinting`.
  // `unitTestRunner` is excluded to remove Jest from the options.
  Except<Schema, 'directory' | 'setParserOptionsProject' | 'unitTestRunner'> &
    // We also exclude `platform` from `NxProjectOptions` because we will hard-code it to be 'frontend'.
    // `domain` is required: a frontend library is placed under `libs/<domain>/` (ADR 0009).
    Except<NxProjectOptions<'frontend', FrontendLibType>, 'platform' | 'domain'> & {
      domain: string;
      unitTestRunner: NgUnitTestRunner;
    }
>;

export type NormalizedNgLibGeneratorOptions = SetRequired<NgLibGeneratorOptions, 'unitTestRunner'> &
  NormalizedNxProjectOptions<'frontend', FrontendLibType>;
