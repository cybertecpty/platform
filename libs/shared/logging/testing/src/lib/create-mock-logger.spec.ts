import { createMockLogger } from './create-mock-logger';

describe('createMockLogger', () => {
  it('returns spies for every logger method', () => {
    const { logger } = createMockLogger();

    logger.debug('a');
    logger.info('b');
    logger.warn('c');
    logger.error('d');

    expect(logger.debug).toHaveBeenCalledWith('a');
    expect(logger.info).toHaveBeenCalledWith('b');
    expect(logger.warn).toHaveBeenCalledWith('c');
    expect(logger.error).toHaveBeenCalledWith('d');
  });

  it('returns the scoped logger from extendScope on either logger', () => {
    const { logger, scopedLogger } = createMockLogger();

    expect(logger.extendScope('x')).toBe(scopedLogger);
    expect(scopedLogger.extendScope('y')).toBe(scopedLogger);
  });

  it('keeps calls on the scoped logger apart from the root logger', () => {
    const { logger, scopedLogger } = createMockLogger();

    scopedLogger.info('scoped');

    expect(scopedLogger.info).toHaveBeenCalledWith('scoped');
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('returns independent mocks on each call', () => {
    const first = createMockLogger();
    const second = createMockLogger();

    first.logger.info('x');

    expect(second.logger.info).not.toHaveBeenCalled();
  });
});
