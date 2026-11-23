import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { injectLogger } from '@cybertecpty/angular-utils';
import type { LogTransport } from '@cybertecpty/logging-utils';
import { withTransports } from './logger-transports';
import { provideLogger } from './provide-logger';
import { withRouterEventsLogging } from './router-events-logging';

const createMockTransport = (): LogTransport => ({
  enableAll: vitest.fn(),
  initialize: vitest.fn(),
  isEnabled: vitest.fn().mockReturnValue(true),
  log: vitest.fn()
});

const loggedEvents = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.map(([message]) => String(message));

describe('provideLogger', () => {
  afterEach(() => {
    vitest.restoreAllMocks();
  });

  it('provides a root logger named after the lower-cased app code', () => {
    TestBed.configureTestingModule({ providers: [provideLogger('APP')] });

    const logger = TestBed.runInInjectionContext(() => injectLogger('InvoiceService'));

    expect(logger.namespace).toBe('app:invoice-service');
  });

  it('logs to the console with every level enabled in dev mode', () => {
    const info = vitest.spyOn(console, 'info').mockImplementation(() => undefined);
    TestBed.configureTestingModule({ providers: [provideLogger('app')] });

    TestBed.runInInjectionContext(() => injectLogger('Invoice')).info('hello');

    expect(info).toHaveBeenCalledTimes(1);
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

  describe('withRouterEventsLogging', () => {
    const navigate = async () => {
      await TestBed.inject(Router).navigateByUrl('/orders');
    };

    it('logs navigation start and end at info level', async () => {
      const info = vitest.spyOn(console, 'info').mockImplementation(() => undefined);
      TestBed.configureTestingModule({
        providers: [
          provideRouter([{ path: '**', children: [] }]),
          provideLogger('app', withRouterEventsLogging())
        ]
      });

      await navigate();

      const events = loggedEvents(info);
      expect(events).toHaveLength(2);
      expect(events[0]).toContain('NavigationStart');
      expect(events[1]).toContain('NavigationEnd');
    });

    it('logs a failed navigation at error level', async () => {
      const error = vitest.spyOn(console, 'error').mockImplementation(() => undefined);
      vitest.spyOn(console, 'info').mockImplementation(() => undefined);
      TestBed.configureTestingModule({
        providers: [provideRouter([]), provideLogger('app', withRouterEventsLogging())]
      });

      await navigate().catch(() => undefined);

      expect(loggedEvents(error)[0]).toContain('NavigationError');
    });

    it('logs nothing without the feature', async () => {
      const info = vitest.spyOn(console, 'info').mockImplementation(() => undefined);
      TestBed.configureTestingModule({
        providers: [provideRouter([{ path: '**', children: [] }]), provideLogger('app')]
      });

      await navigate();

      expect(info).not.toHaveBeenCalled();
    });
  });
});
