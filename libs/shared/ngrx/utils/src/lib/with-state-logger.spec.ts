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

type TestStoreInstance = InstanceType<typeof TestStore>;

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

  it('throws when the Logger is not provided', () => {
    configureTestingModule();

    expect(createStore).toThrow('injectLogger() needs provideLogger()');
  });
});
