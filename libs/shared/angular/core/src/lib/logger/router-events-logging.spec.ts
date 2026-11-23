import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideLogger } from './provide-logger';
import { withRouterEventsLogging } from './router-events-logging';

const loggedEvents = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.map(([message]) => String(message));

describe('withRouterEventsLogging', () => {
  const navigate = async (url = '/orders') => {
    await TestBed.inject(Router).navigateByUrl(url);
  };

  const mockConsole = () => ({
    debug: vitest.spyOn(console, 'debug').mockImplementation(() => undefined),
    error: vitest.spyOn(console, 'error').mockImplementation(() => undefined),
    info: vitest.spyOn(console, 'info').mockImplementation(() => undefined),
    warn: vitest.spyOn(console, 'warn').mockImplementation(() => undefined)
  });

  afterEach(() => {
    vitest.restoreAllMocks();
  });

  it('logs navigation start and end at info level', async () => {
    const { info } = mockConsole();
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

  it('logs a cancelled navigation at warn level', async () => {
    const { warn } = mockConsole();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'blocked', canActivate: [() => false], children: [] }]),
        provideLogger('app', withRouterEventsLogging())
      ]
    });

    await navigate('/blocked');

    expect(loggedEvents(warn)[0]).toContain('NavigationCancel');
  });

  it('logs a failed navigation at error level', async () => {
    const { error } = mockConsole();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideLogger('app', withRouterEventsLogging())]
    });

    await navigate().catch(() => undefined);

    expect(loggedEvents(error)[0]).toContain('NavigationError');
  });

  it('logs a skipped navigation at debug level', async () => {
    const { debug } = mockConsole();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        provideLogger('app', withRouterEventsLogging())
      ]
    });

    await navigate();
    await navigate();

    expect(loggedEvents(debug)[0]).toContain('NavigationSkipped');
  });

  it('logs nothing without the feature', async () => {
    const { info } = mockConsole();
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '**', children: [] }]), provideLogger('app')]
    });

    await navigate();

    expect(info).not.toHaveBeenCalled();
  });
});
