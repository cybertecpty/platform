import { orderByKeys } from './records.utils';

describe('orderByKeys', () => {
  it('orders keys ascending by default', () => {
    expect(Object.keys(orderByKeys({ c: 3, a: 1, b: 2 }))).toEqual(['a', 'b', 'c']);
  });

  it('orders keys ascending when dir is asc', () => {
    expect(Object.keys(orderByKeys({ c: 3, a: 1, b: 2 }, 'asc'))).toEqual(['a', 'b', 'c']);
  });

  it('orders keys descending when dir is desc', () => {
    expect(Object.keys(orderByKeys({ c: 3, a: 1, b: 2 }, 'desc'))).toEqual(['c', 'b', 'a']);
  });

  it('keeps each value with its key', () => {
    expect(orderByKeys({ c: 3, a: 1, b: 2 })).toEqual({ a: 1, b: 2, c: 3 });
  });

  it('orders uppercase before lowercase and punctuation by code unit', () => {
    const keys = Object.keys(orderByKeys({ a: 0, B: 0, _x: 0 }));

    expect(keys).toEqual(['B', '_x', 'a']);
    expect(keys).toEqual(['a', 'B', '_x'].sort());
  });

  it('reverses the code-unit order when dir is desc', () => {
    expect(Object.keys(orderByKeys({ a: 0, B: 0, _x: 0 }, 'desc'))).toEqual(['a', '_x', 'B']);
  });

  it('orders scoped package names by code unit', () => {
    const keys = Object.keys(orderByKeys({ '@nx/js': 0, '@cybertecpty/x': 0, tslib: 0 }));

    expect(keys).toEqual(['@cybertecpty/x', '@nx/js', 'tslib']);
  });

  it('orders integer-like keys ascending whatever dir says', () => {
    const record = { '10': 'ten', '1': 'one', '2': 'two' };

    expect(Object.keys(orderByKeys(record, 'asc'))).toEqual(['1', '2', '10']);
    expect(Object.keys(orderByKeys(record, 'desc'))).toEqual(['1', '2', '10']);
  });

  it('returns an empty record for an empty record', () => {
    expect(orderByKeys({})).toEqual({});
  });

  it('does not mutate the input', () => {
    const record = { b: 1, a: 2 };

    orderByKeys(record);

    expect(Object.keys(record)).toEqual(['b', 'a']);
  });

  it('returns the same order for any insertion order', () => {
    const forward = orderByKeys({ a: 1, B: 2, _x: 3, c: 4 });
    const reversed = orderByKeys({ c: 4, _x: 3, B: 2, a: 1 });

    expect(Object.keys(forward)).toEqual(Object.keys(reversed));
  });
});
