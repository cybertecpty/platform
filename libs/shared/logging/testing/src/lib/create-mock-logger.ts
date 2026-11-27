import type { Logger } from '@cybertecpty/logging-utils';
import type { Mocked, MockedFunction } from 'vitest';

interface MockLogger {
  logger: Mocked<Logger>;
  scopedLogger: Mocked<Logger>;
}

export const createMockLogger = (): MockLogger => {
  const scopedLogger = {
    debug: vitest.fn(),
    error: vitest.fn(),
    extendScope: vitest.fn(),
    info: vitest.fn(),
    warn: vitest.fn()
  } as unknown as Mocked<Logger>;

  (scopedLogger.extendScope as MockedFunction<Logger['extendScope']>).mockReturnValue(scopedLogger);

  const logger = {
    debug: vitest.fn(),
    error: vitest.fn(),
    extendScope: vitest.fn(),
    info: vitest.fn(),
    warn: vitest.fn()
  } as unknown as Mocked<Logger>;

  (logger.extendScope as MockedFunction<Logger['extendScope']>).mockReturnValue(scopedLogger);

  return { logger, scopedLogger };
};
