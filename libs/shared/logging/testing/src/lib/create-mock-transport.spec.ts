import { createMockTransport } from './create-mock-transport';

describe('createMockTransport', () => {
  it('returns spies for every transport method', () => {
    const transport = createMockTransport();

    transport.initialize('app', ['info']);
    transport.enableAll();
    transport.log('app:x', 'info', 'hello');

    expect(vitest.isMockFunction(transport.log)).toBe(true);
    expect(transport.log).toHaveBeenCalledWith('app:x', 'info', 'hello');
    expect(transport.initialize).toHaveBeenCalledWith('app', ['info']);
    expect(transport.enableAll).toHaveBeenCalledTimes(1);
  });

  it('reports every namespace as enabled', () => {
    expect(createMockTransport().isEnabled('anything', 'info')).toBe(true);
  });

  it('returns independent spies on each call', () => {
    const first = createMockTransport();
    const second = createMockTransport();

    first.log('a', 'info', 'x');

    expect(second.log).not.toHaveBeenCalled();
  });
});
