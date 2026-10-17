import { lastCallArg } from './nx-mock-calls.utils';

describe('lastCallArg', () => {
  it("returns the given argument of the mock's most recent call", () => {
    const mock = jest.fn<void, [string, { tags: string }]>();

    mock('first', { tags: 'scope:shared' });
    mock('second', { tags: 'scope:tools' });

    expect(lastCallArg(mock, 0, 'demo')).toBe('second');
    expect(lastCallArg(mock, 1, 'demo')).toEqual({ tags: 'scope:tools' });
  });

  it('throws an error naming the mock when it was never called', () => {
    const mock = jest.fn<void, [string]>();

    expect(() => lastCallArg(mock, 0, '`@nx/js:library`')).toThrow(
      '`@nx/js:library` was never called'
    );
  });
});
