import { TestBed } from '@angular/core/testing';
import { injectLogger } from '@cybertecpty/angular-utils';
import { provideLogger } from './provide-logger';

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
});
