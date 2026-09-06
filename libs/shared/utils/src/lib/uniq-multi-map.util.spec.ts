import { UniqMultiMap } from './uniq-multi-map.util';

describe('UniqMultiMap', () => {
  let map: UniqMultiMap<string>;

  beforeEach(() => {
    map = new UniqMultiMap();
  });

  describe('addMany', () => {
    it('adds multiple values to a new key', () => {
      map.addMany('colors', ['red', 'blue']);
      expect(map.get('colors')).toEqual(new Set(['red', 'blue']));
    });

    it('adds values to an existing key', () => {
      map.addOne('colors', 'green');
      map.addMany('colors', ['blue', 'yellow']);
      expect(map.get('colors')).toEqual(new Set(['green', 'blue', 'yellow']));
    });

    it('ignores duplicates when adding', () => {
      map.addMany('numbers', [1, 2, 2, 3]);
      expect(map.get('numbers')).toEqual(new Set([1, 2, 3]));
    });

    it('does not create the key for an empty iterable', () => {
      map.addMany('empty', []);
      expect(map.has('empty')).toBe(false);
      expect(map.getAll('empty')).toEqual([]);
    });

    it('returns itself for chaining', () => {
      expect(map.addMany('a', ['x']).addMany('b', ['y'])).toBe(map);
      expect(map.getAll('b')).toEqual(['y']);
    });
  });

  describe('addOne', () => {
    it('adds a single value to a new key', () => {
      map.addOne('fruit', 'apple');
      expect(map.get('fruit')).toEqual(new Set(['apple']));
    });

    it('adds multiple unique values to the same key', () => {
      map.addOne('fruit', 'apple').addOne('fruit', 'banana');
      expect(map.get('fruit')).toEqual(new Set(['apple', 'banana']));
    });

    it('does not add duplicates', () => {
      map.addOne('fruit', 'apple').addOne('fruit', 'apple');
      expect(map.get('fruit')).toEqual(new Set(['apple']));
    });

    it('returns itself for chaining', () => {
      expect(map.addOne('fruit', 'apple')).toBe(map);
    });
  });

  describe('getAll', () => {
    it('returns all values for an existing key', () => {
      map.addMany('shapes', ['circle', 'square']);
      expect(map.getAll('shapes').sort()).toEqual(['circle', 'square']);
    });

    it('returns an empty array for a non-existent key', () => {
      expect(map.getAll('missing')).toEqual([]);
    });

    it('returns a copy that does not affect the map when mutated', () => {
      map.addMany('shapes', ['circle', 'square']);
      const values = map.getAll('shapes');
      values.push('triangle');
      expect(map.getAll('shapes').sort()).toEqual(['circle', 'square']);
    });
  });

  describe('hasValue', () => {
    it('returns true if value exists for the key', () => {
      map.addOne('tools', 'hammer');
      expect(map.hasValue('tools', 'hammer')).toBe(true);
    });

    it('returns false if value does not exist for the key', () => {
      map.addOne('tools', 'hammer');
      expect(map.hasValue('tools', 'screwdriver')).toBe(false);
    });

    it('returns false if key does not exist', () => {
      expect(map.hasValue('missing', 'value')).toBe(false);
    });
  });

  describe('removeOne', () => {
    it('removes a value and retains the key if more values exist', () => {
      map.addMany('pets', ['cat', 'dog']);
      const result = map.removeOne('pets', 'cat');
      expect(result).toBe(true);
      expect(map.get('pets')).toEqual(new Set(['dog']));
    });

    it('removes the key if no values remain', () => {
      map.addOne('pets', 'cat');
      map.removeOne('pets', 'cat');
      expect(map.has('pets')).toBe(false);
    });

    it('returns false if key does not exist', () => {
      expect(map.removeOne('unknown', 'thing')).toBe(false);
    });

    it('returns false if value does not exist under key', () => {
      map.addOne('pets', 'cat');
      expect(map.removeOne('pets', 'dog')).toBe(false);
    });
  });

  describe('removeMany', () => {
    it('removes multiple values and returns count of removed values', () => {
      map.addMany('letters', ['a', 'b', 'c']);
      const removedCount = map.removeMany('letters', ['a', 'c']);
      expect(removedCount).toBe(2);
      expect(map.get('letters')).toEqual(new Set(['b']));
    });

    it('retains the key when values remain after a partial removal', () => {
      map.addMany('letters', ['a', 'b', 'c']);
      map.removeMany('letters', ['a', 'z']);
      expect(map.has('letters')).toBe(true);
      expect(map.getAll('letters').sort()).toEqual(['b', 'c']);
    });

    it('removes the key if all values are removed', () => {
      map.addMany('letters', ['a']);
      map.removeMany('letters', ['a']);
      expect(map.has('letters')).toBe(false);
    });

    it('returns 0 if key does not exist', () => {
      expect(map.removeMany('missing', ['x', 'y'])).toBe(0);
    });

    it('only counts values that actually existed', () => {
      map.addMany('nums', [1, 2]);
      const result = map.removeMany('nums', [1, 2, 3, 4]);
      expect(result).toBe(2);
    });
  });

  describe('numeric keys and values', () => {
    it('supports number keys and values across the API', () => {
      const numMap = new UniqMultiMap<number, number>();
      numMap.addMany(1, [10, 20]).addOne(2, 30);

      expect(numMap.hasValue(1, 20)).toBe(true);
      expect(numMap.removeOne(1, 10)).toBe(true);
      expect(numMap.getAll(1)).toEqual([20]);
    });
  });
});
