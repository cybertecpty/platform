import type { UnitTestRunner } from '@nx/angular/generators';

export type NgUnitTestRunner = Exclude<UnitTestRunner, UnitTestRunner.Jest>;
