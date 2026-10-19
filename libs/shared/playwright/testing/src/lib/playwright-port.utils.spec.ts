import { derivePort } from './playwright-port.utils';

describe('derivePort', () => {
  const RANGE = { base: 4400, span: 500 };

  it('returns the same port for the same key', () => {
    expect(derivePort('C:/work/platform', RANGE)).toBe(derivePort('C:/work/platform', RANGE));
  });

  it('stays inside [base, base + span)', () => {
    const keys = Array.from({ length: 200 }, (_, index) => `/work/tree-${index}`);

    for (const key of keys) {
      const port = derivePort(key, RANGE);

      expect(port).toBeGreaterThanOrEqual(RANGE.base);
      expect(port).toBeLessThan(RANGE.base + RANGE.span);
    }
  });

  it('spreads different keys across different ports', () => {
    const keys = Array.from({ length: 50 }, (_, index) => `/work/tree-${index}`);
    const ports = new Set(keys.map(key => derivePort(key, RANGE)));

    expect(ports.size).toBeGreaterThan(40);
  });

  it('treats path separators and letter case as equivalent', () => {
    expect(derivePort(String.raw`C:\Work\Platform`, RANGE)).toBe(
      derivePort('c:/work/platform', RANGE)
    );
  });

  it('ignores a trailing separator', () => {
    expect(derivePort('/work/platform/', RANGE)).toBe(derivePort('/work/platform', RANGE));
  });

  it.each([
    ['a base below 1024', { base: 80, span: 10 }],
    ['a span of zero', { base: 4400, span: 0 }],
    ['a range past 65535', { base: 65000, span: 1000 }],
    ['a fractional span', { base: 4400, span: 1.5 }]
  ])('rejects %s', (_label, range) => {
    expect(() => derivePort('/work/platform', range)).toThrow(RangeError);
  });
});
