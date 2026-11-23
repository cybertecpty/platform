import { TestBed } from '@angular/core/testing';
import { Logger } from '@cybertecpty/logging-utils';
import { provideMockLogger } from './provide-mock-logger';

describe('provideMockLogger', () => {
  it('provides a logger named after the app code with no transports', () => {
    TestBed.configureTestingModule({ providers: [provideMockLogger('app')] });

    const logger = TestBed.inject(Logger);

    expect(logger.namespace).toBe('app');
    expect(logger.transports).toEqual([]);
  });

  it('names the logger test when no app code is given', () => {
    TestBed.configureTestingModule({ providers: [provideMockLogger()] });

    expect(TestBed.inject(Logger).namespace).toBe('test');
  });
});
