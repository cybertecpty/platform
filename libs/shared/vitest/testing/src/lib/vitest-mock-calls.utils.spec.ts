import { lastCallArg } from './vitest-mock-calls.utils';

describe('lastCallArg', () => {
  it("returns the given argument of the mock's most recent call", () => {
    const mock = vi.fn<(name: string, options: { tags: string }) => void>();

    mock('first', { tags: 'platform:shared' });
    mock('second', { tags: 'platform:tools' });

    expect(lastCallArg(mock, 0, 'demo')).toBe('second');
    expect(lastCallArg(mock, 1, 'demo')).toEqual({ tags: 'platform:tools' });
  });

  it('throws an error naming the mock when it was never called', () => {
    const mock = vi.fn<(name: string) => void>();

    expect(() => lastCallArg(mock, 0, '`@nx/js:library`')).toThrow(
      '`@nx/js:library` was never called'
    );
  });
});
