import { TestBed } from '@angular/core/testing';
import { injectLogger } from '@cybertecpty/angular-utils';
import { createMockTransport } from '@cybertecpty/logging-testing';
import { withTransports } from './logger-transports';
import { provideLogger } from './provide-logger';

describe('logger-transports', () => {
  afterEach(() => {
    vitest.restoreAllMocks();
    vitest.unstubAllGlobals();
  });

  describe('default transport', () => {
    it('logs only warnings and errors outside dev mode', () => {
      vitest.stubGlobal('ngDevMode', false);
      const info = vitest.spyOn(console, 'info').mockImplementation(() => undefined);
      const warn = vitest.spyOn(console, 'warn').mockImplementation(() => undefined);
      TestBed.configureTestingModule({ providers: [provideLogger('app')] });
      const logger = TestBed.runInInjectionContext(() => injectLogger('Invoice'));

      logger.info('hidden');
      logger.warn('shown');

      expect(info).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledTimes(1);
    });
  });

  describe('withTransports', () => {
    it('sends log calls to the given transports', () => {
      const first = createMockTransport();
      const second = createMockTransport();
      TestBed.configureTestingModule({
        providers: [provideLogger('app', withTransports(first, second))]
      });

      TestBed.runInInjectionContext(() => injectLogger('Invoice')).info('hello');

      expect(first.log).toHaveBeenCalledWith('app:invoice', 'info', 'hello');
      expect(second.log).toHaveBeenCalledWith('app:invoice', 'info', 'hello');
    });

    it('replaces the default console transport', () => {
      const info = vitest.spyOn(console, 'info').mockImplementation(() => undefined);
      TestBed.configureTestingModule({
        providers: [provideLogger('app', withTransports(createMockTransport()))]
      });

      TestBed.runInInjectionContext(() => injectLogger('Invoice')).info('hello');

      expect(info).not.toHaveBeenCalled();
    });

    it('uses the last feature when it is provided twice', () => {
      const first = createMockTransport();
      const second = createMockTransport();
      TestBed.configureTestingModule({
        providers: [provideLogger('app', withTransports(first), withTransports(second))]
      });

      TestBed.runInInjectionContext(() => injectLogger('Invoice')).info('hello');

      expect(first.log).not.toHaveBeenCalled();
      expect(second.log).toHaveBeenCalledTimes(1);
    });
  });
});
