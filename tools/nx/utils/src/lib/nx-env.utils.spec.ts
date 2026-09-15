import { dryRunEnabled, verboseEnabled } from './nx-env.utils';

describe('nx-env.utils', () => {
  const ENV_KEYS = ['NX_DRY_RUN', 'NX_VERBOSE_LOGGING'] as const;
  const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = saved[key];

      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  describe.each([
    ['dryRunEnabled', 'NX_DRY_RUN', dryRunEnabled],
    ['verboseEnabled', 'NX_VERBOSE_LOGGING', verboseEnabled]
  ] as const)('%s', (_label, envVar, predicate) => {
    it(`returns true when ${envVar} is exactly "true"`, () => {
      process.env[envVar] = 'true';

      expect(predicate()).toBe(true);
    });

    // Nx's generate middleware writes "false"/"undefined" when the flag is absent;
    // anything but the exact string "true" must read as off.
    it.each(['false', 'undefined', '1', 'TRUE', ' true '])(
      `returns false when ${envVar} is "%s"`,
      value => {
        process.env[envVar] = value;

        expect(predicate()).toBe(false);
      }
    );

    it(`returns false when ${envVar} is unset`, () => {
      delete process.env[envVar];

      expect(predicate()).toBe(false);
    });

    it('is not affected by the other flag being set', () => {
      const otherVar = ENV_KEYS.find(key => key !== envVar) as string;
      process.env[otherVar] = 'true';

      expect(predicate()).toBe(false);
    });
  });
});
