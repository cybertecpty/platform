import { TestBed } from '@angular/core/testing';
import { provideMockLogger } from '@cybertecpty/angular-testing';
import { injectLogger } from './inject-logger';

describe('injectLogger', () => {
  it('throws a message naming provideLogger when it was not provided', () => {
    expect(() => TestBed.runInInjectionContext(() => injectLogger('InvoiceService'))).toThrow(
      'injectLogger() needs provideLogger() in the application config'
    );
  });

  it('returns a logger scoped to the kebab-cased source under the app code', () => {
    TestBed.configureTestingModule({ providers: [provideMockLogger('app')] });

    const logger = TestBed.runInInjectionContext(() => injectLogger('InvoiceService'));

    expect(logger.namespace).toBe('app:invoice-service');
  });
});
