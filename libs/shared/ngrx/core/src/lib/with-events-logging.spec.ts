import { TestBed } from '@angular/core/testing';
import { createMockLogger } from '@cybertecpty/logging-testing';
import { Logger } from '@cybertecpty/logging-utils';
import { type } from '@ngrx/signals';
import { Dispatcher, event } from '@ngrx/signals/events';
import { withEventsLogging } from './with-events-logging';

const reset = event('reset');
const countSet = event('countSet', type<number>());

describe('withEventsLogging', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  const setUp = () => {
    const mock = createMockLogger();
    TestBed.configureTestingModule({
      providers: [{ provide: Logger, useValue: mock.logger }, ...withEventsLogging().providers]
    });
    const dispatcher = TestBed.inject(Dispatcher);

    return { ...mock, dispatcher };
  };

  it('scopes the logger to store-events', () => {
    const { logger } = setUp();

    expect(logger.extendScope).toHaveBeenCalledExactlyOnceWith('store-events');
  });

  it('logs each dispatched event at info with its type and payload', () => {
    const { dispatcher, scopedLogger } = setUp();

    dispatcher.dispatch(countSet(5));

    expect(scopedLogger.info).toHaveBeenCalledExactlyOnceWith('countSet', 5);
  });

  it('logs an event without a payload', () => {
    const { dispatcher, scopedLogger } = setUp();

    dispatcher.dispatch(reset());

    expect(scopedLogger.info).toHaveBeenCalledExactlyOnceWith('reset', undefined);
  });

  it('stops logging once the injector is destroyed', () => {
    const { dispatcher, scopedLogger } = setUp();
    TestBed.resetTestingModule();

    dispatcher.dispatch(reset());

    expect(scopedLogger.info).not.toHaveBeenCalled();
  });
});
