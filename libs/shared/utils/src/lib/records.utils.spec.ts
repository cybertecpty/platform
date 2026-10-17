import * as utils from './records.utils';

describe('records.utils', () => {
  describe('orderByKeys', () => {
    it('should sort record keys in ascending order', () => {
      const record = { c: 3, a: 1, b: 2 };
      const result = utils.orderByKeys(record, 'asc');

      expect(Object.keys(result)).toEqual(['a', 'b', 'c']);
    });

    it('should sort record keys in descending order', () => {
      const record = { c: 3, a: 1, b: 2 };
      const result = utils.orderByKeys(record, 'desc');

      expect(Object.keys(result)).toEqual(['c', 'b', 'a']);
    });
  });
});
