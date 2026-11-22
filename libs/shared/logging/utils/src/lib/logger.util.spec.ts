import type { LogTransport } from './logger-transport.util';
import { LOG_LEVELS, Logger } from './logger.util';

class MockTransport implements LogTransport {
  initialize = vitest.fn();
  isEnabled = vitest.fn();
  log = vitest.fn();
  enableAll = vitest.fn();
}

describe('Logger', () => {
  let logger: Logger;
  let transport: MockTransport;

  const namespace = 'test-namespace';

  beforeEach(() => {
    transport = new MockTransport();
    logger = new Logger(namespace, [transport]);
  });

  it('creates an instance', () => {
    expect(logger).toBeTruthy();
  });

  it('initializes transports on creation using default log levels', () => {
    expect(transport.initialize).toHaveBeenCalledWith(namespace, LOG_LEVELS);
  });

  it('emits debug logs', () => {
    const message = 'Debug message';
    logger.debug(message);
    expect(transport.log).toHaveBeenCalledWith(namespace, 'debug', message);
  });

  it('emits info logs', () => {
    const message = 'Info message';
    logger.info(message);
    expect(transport.log).toHaveBeenCalledWith(namespace, 'info', message);
  });

  it('emits warn logs', () => {
    const message = 'Warn message';
    logger.warn(message);
    expect(transport.log).toHaveBeenCalledWith(namespace, 'warn', message);
  });

  it('emits error logs', () => {
    const message = 'Error message';
    logger.error(message);
    expect(transport.log).toHaveBeenCalledWith(namespace, 'error', message);
  });

  it('drops logs at levels the logger was not created with', () => {
    const restricted = new Logger(namespace, [transport], ['warn', 'error']);

    restricted.debug('Debug message');
    restricted.info('Info message');
    restricted.warn('Warn message');

    expect(transport.log).toHaveBeenCalledTimes(1);
    expect(transport.log).toHaveBeenCalledWith(namespace, 'warn', 'Warn message');
  });

  it('forwards every argument to the transports', () => {
    const details = { id: 1 };

    logger.info('Created %s', 'invoice', details);

    expect(transport.log).toHaveBeenCalledWith(namespace, 'info', 'Created %s', 'invoice', details);
  });

  it('logs through the same transports after extending scope', () => {
    const child = logger.extendScope('New Scope');

    child.warn('Warn message');

    expect(transport.initialize).toHaveBeenCalledWith('test-namespace:new-scope', LOG_LEVELS);
    expect(transport.log).toHaveBeenCalledWith('test-namespace:new-scope', 'warn', 'Warn message');
  });

  describe('isEnabled', () => {
    it('is enabled when a transport reports the level enabled for the namespace', () => {
      transport.isEnabled.mockReturnValue(true);

      expect(logger.isEnabled('info')).toBe(true);
      expect(transport.isEnabled).toHaveBeenCalledWith(namespace, 'info');
    });

    it('is disabled when no transport reports the level enabled', () => {
      transport.isEnabled.mockReturnValue(false);

      expect(logger.isEnabled('info')).toBe(false);
    });

    it('is enabled when any one of several transports reports it enabled', () => {
      const other = new MockTransport();
      transport.isEnabled.mockReturnValue(false);
      other.isEnabled.mockReturnValue(true);

      expect(new Logger(namespace, [transport, other]).isEnabled('warn')).toBe(true);
    });

    it('is disabled for a level the logger was not created with', () => {
      transport.isEnabled.mockReturnValue(true);
      const restricted = new Logger(namespace, [transport], ['error']);

      expect(restricted.isEnabled('debug')).toBe(false);
      expect(transport.isEnabled).not.toHaveBeenCalled();
    });
  });

  it('extends scope correctly', () => {
    const extendedLogger = logger.extendScope('New Scope');
    expect(extendedLogger.namespace).toBe('test-namespace:new-scope');
  });

  it('keeps the levels when extending scope', () => {
    const restricted = new Logger(namespace, [transport], ['error']);

    restricted.extendScope('child').info('Info message');

    expect(transport.log).not.toHaveBeenCalled();
  });
});
