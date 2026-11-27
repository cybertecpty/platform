import { TestBed } from '@angular/core/testing';
import { createMockTransport } from '@cybertecpty/logging-testing';
import { Logger } from '@cybertecpty/logging-utils';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { withStateLogger } from './with-state-logger';

interface TestState {
  count: number;
}

const initialTestState: TestState = { count: 0 };

const TestStore = signalStore(
  { providedIn: 'root' },
  withStateLogger('TestStore'),
  withState(initialTestState),
  withMethods(store => ({
    setCount(count: number) {
      patchState(store, () => ({ count }));
    }
  }))
);

interface SessionState {
  user: string;
  token: string;
  email: string;
}

type TestStoreInstance = InstanceType<typeof TestStore>;

const initialSessionState: SessionState = {
  user: 'ada',
  token: 's3cret',
  email: 'ada@example.com'
};

const SessionStore = signalStore(
  { providedIn: 'root' },
  withStateLogger('Session', { omit: ['token'], mask: ['email'] }),
  withState(initialSessionState),
  withMethods(store => ({
    setToken(token: string) {
      patchState(store, () => ({ token }));
    }
  }))
);

const configureTestingModule = (providers: unknown[] = []) =>
  TestBed.configureTestingModule({
    providers: [TestStore, ...providers]
  });

const createStore = (): TestStoreInstance => TestBed.inject(TestStore);

describe('withStateLogger', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('logs the state at init and after each change under the store scope', () => {
    const transport = createMockTransport();
    configureTestingModule([{ provide: Logger, useValue: new Logger('app', [transport]) }]);

    const store = createStore();

    expect(transport.log).toHaveBeenCalledExactlyOnceWith(
      'app:test-store',
      'debug',
      '[watchState]',
      { count: 0 }
    );

    store.setCount(1);

    expect(store.count()).toBe(1);
    expect(transport.log).toHaveBeenLastCalledWith('app:test-store', 'debug', '[watchState]', {
      count: 1
    });
    expect(transport.log).toHaveBeenCalledTimes(2);
  });

  it('keeps omitted fields away from the transport and masks the masked ones', () => {
    const transport = createMockTransport();
    configureTestingModule([{ provide: Logger, useValue: new Logger('app', [transport]) }]);

    const store = TestBed.inject(SessionStore);
    store.setToken('another-secret');

    expect(transport.log).toHaveBeenCalledTimes(2);
    for (const call of vi.mocked(transport.log).mock.calls) {
      expect(call[3]).toEqual({ user: 'ada', email: '[REDACTED]' });
      expect(JSON.stringify(call)).not.toContain('secret');
      expect(JSON.stringify(call)).not.toContain('ada@example.com');
    }
    expect(store.token()).toBe('another-secret');
  });

  it('throws when the Logger is not provided', () => {
    configureTestingModule();

    expect(createStore).toThrow('injectLogger() needs provideLogger()');
  });
});
