import { Mock } from 'vitest';
import { ConsoleTransport, type LogTransport, NoopTransport } from './logger-transport.util';
import { LOG_LEVELS } from './logger.util';

type MockDebugger = Mock & {
  enabled: boolean;
  log: Mock;
};

const debugInstances = new Map<string, MockDebugger>();

vitest.mock('debug', () => ({
  default: vitest.fn()
}));

const registerDebugger = (namespace: string): MockDebugger => {
  const logger: MockDebugger = Object.assign(vitest.fn(), {
    enabled: false,
    log: vitest.fn()
  });

  debugInstances.set(namespace, logger);

  return logger;
};

describe('logger-transport.util', () => {
  describe('ConsoleTransport', () => {
    let transport: ConsoleTransport;

    const namespace = 'test-namespace';

    beforeEach(async () => {
      transport = new ConsoleTransport();
      debugInstances.clear();
      const { default: debugMock } = await vitest.importMock<{ default: Mock }>('debug');
      debugMock.mockReset();
      debugMock.mockImplementation(namespaceArg => registerDebugger(namespaceArg));
    });

    it('creates instance', () => {
      expect(transport).toBeTruthy();
    });

    it('initializes loggers for each level and binds console methods', () => {
      const consoleSpies = LOG_LEVELS.map(level =>
        vitest.spyOn(console, level).mockImplementation(() => undefined)
      );

      transport.initialize(namespace, LOG_LEVELS);

      LOG_LEVELS.forEach((level, index) => {
        const logger = debugInstances.get(`${namespace}:${level}`);

        expect(logger).toBeDefined();

        logger?.log('message');
        expect(consoleSpies[index]).toHaveBeenCalledWith('message');
      });

      consoleSpies.forEach(spy => spy.mockRestore());
    });

    it('uses a console method patched after the logger was created', () => {
      transport.initialize(namespace, LOG_LEVELS);
      const infoSpy = vitest.spyOn(console, 'info').mockImplementation(() => undefined);

      debugInstances.get(`${namespace}:info`)?.log('message');

      expect(infoSpy).toHaveBeenCalledWith('message');

      infoSpy.mockRestore();
    });

    it('reuses existing loggers when a namespace is initialized again', async () => {
      const { default: debugMock } = await vitest.importMock<{ default: Mock }>('debug');

      transport.initialize(namespace, LOG_LEVELS);
      const first = debugInstances.get(`${namespace}:info`);

      transport.initialize(namespace, LOG_LEVELS);

      expect(debugMock).toHaveBeenCalledTimes(LOG_LEVELS.length);
      expect(debugInstances.get(`${namespace}:info`)).toBe(first);
    });

    it('binds console methods on loggers created lazily', () => {
      const warnSpy = vitest.spyOn(console, 'warn').mockImplementation(() => undefined);

      transport.log(namespace, 'warn', 'message');

      debugInstances.get(`${namespace}:warn`)?.log('message');
      expect(warnSpy).toHaveBeenCalledWith('message');

      warnSpy.mockRestore();
    });

    it('logs through debug instances', () => {
      transport.initialize(namespace, LOG_LEVELS);

      const debugLogger = debugInstances.get(`${namespace}:debug`);

      expect(debugLogger).toBeDefined();

      transport.log(namespace, 'debug', 'format', 'arg');

      expect(debugLogger as MockDebugger).toHaveBeenCalledWith('format', 'arg');
    });

    it('logs nothing when called without arguments', () => {
      transport.initialize(namespace, LOG_LEVELS);

      transport.log(namespace, 'debug');

      expect(debugInstances.get(`${namespace}:debug`)).not.toHaveBeenCalled();
    });

    it('reports enabled state for namespaces', () => {
      transport.initialize(namespace, LOG_LEVELS);

      expect(transport.isEnabled(namespace, 'info')).toBe(false);

      transport.enableAll();

      expect(transport.isEnabled(namespace, 'info')).toBe(true);
    });

    it('reports state for a namespace that was never initialized', () => {
      expect(transport.isEnabled('unknown-namespace', 'debug')).toBe(false);
      expect(transport.isEnabled('unknown-namespace', 'error')).toBe(true);
    });

    it('reuses the logger created by isEnabled when the namespace is logged to', async () => {
      const { default: debugMock } = await vitest.importMock<{ default: Mock }>('debug');

      transport.isEnabled('unknown-namespace', 'error');
      transport.log('unknown-namespace', 'error', 'message');

      expect(debugMock).toHaveBeenCalledTimes(1);
      expect(debugInstances.get('unknown-namespace:error')).toHaveBeenCalledWith('message');
    });

    it('logs every argument, not only the first', () => {
      transport.initialize(namespace, LOG_LEVELS);

      transport.log(namespace, 'error', 'Failed %s', 'save', { id: 1 });

      expect(debugInstances.get(`${namespace}:error`)).toHaveBeenCalledWith('Failed %s', 'save', {
        id: 1
      });
    });

    it('enables warn and error without enableAll, and leaves debug and info off', () => {
      transport.initialize(namespace, LOG_LEVELS);

      expect(transport.isEnabled(namespace, 'warn')).toBe(true);
      expect(transport.isEnabled(namespace, 'error')).toBe(true);
      expect(transport.isEnabled(namespace, 'debug')).toBe(false);
      expect(transport.isEnabled(namespace, 'info')).toBe(false);
    });

    it('makes every level opt-in when alwaysEnabled is empty', () => {
      const optIn = new ConsoleTransport({ alwaysEnabled: [] });
      optIn.initialize(namespace, LOG_LEVELS);

      LOG_LEVELS.forEach(level => {
        expect(optIn.isEnabled(namespace, level)).toBe(false);
      });
    });

    it('enables the levels given in alwaysEnabled', () => {
      const custom = new ConsoleTransport({ alwaysEnabled: ['info', 'error'] });
      custom.initialize(namespace, LOG_LEVELS);

      expect(custom.isEnabled(namespace, 'info')).toBe(true);
      expect(custom.isEnabled(namespace, 'error')).toBe(true);
      expect(custom.isEnabled(namespace, 'warn')).toBe(false);
    });

    it('enables existing and future loggers after enableAll', () => {
      transport.initialize(namespace, LOG_LEVELS);

      transport.enableAll();

      LOG_LEVELS.forEach(level => {
        const logger = debugInstances.get(`${namespace}:${level}`);
        expect(logger?.enabled).toBe(true);
      });

      const otherNamespace = 'other-namespace';
      transport.initialize(otherNamespace, LOG_LEVELS);

      LOG_LEVELS.forEach(level => {
        const logger = debugInstances.get(`${otherNamespace}:${level}`);
        expect(logger?.enabled).toBe(true);
      });
    });

    it('enables loggers created lazily after enableAll', () => {
      transport.enableAll();

      transport.log(namespace, 'warn', 'message');

      const logger = debugInstances.get(`${namespace}:warn`);
      expect(logger?.enabled).toBe(true);
    });
  });

  describe('NoopTransport', () => {
    const transport: LogTransport = new NoopTransport();

    it('is never enabled', () => {
      expect(transport.isEnabled('test-namespace', 'debug')).toBe(false);
    });

    it('discards initialize, log, and enableAll calls', () => {
      expect(() => {
        transport.initialize('test-namespace', LOG_LEVELS);
        transport.log('test-namespace', 'debug', 'message');
        transport.enableAll();
      }).not.toThrow();
    });
  });
});
