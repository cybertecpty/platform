/**
 * Extends the Map class to create a multi-map that facilitates storing multiple
 * values for a single key. The values are stored in a Set to ensure uniqueness.
 *
 * The map maintains a "no empty sets" invariant: a key exists only while it has
 * at least one value. Adding an empty iterable is a no-op, and removing the last
 * value deletes the key.
 *
 * Note: `get` and `entries` expose the live internal Set for a key. Mutating it
 * directly bypasses the uniqueness and no-empty-key guarantees.
 */
export class UniqMultiMap<K, V = unknown> extends Map<K, Set<V>> {
  /**
   * Adds multiple values to the set associated with the given key, creating the
   * key on first insertion. Duplicate values are ignored. An empty iterable is a
   * no-op and does not create the key.
   */
  addMany(key: K, values: Iterable<V>): this {
    let set: Set<V> | undefined = this.get(key);

    for (const value of values) {
      set ??= this.getOrCreate(key);
      set.add(value);
    }

    return this;
  }

  /**
   * Adds a single value to the set associated with the given key, creating the
   * key if it does not exist. A duplicate value is ignored.
   */
  addOne(key: K, value: V): this {
    this.getOrCreate(key).add(value);

    return this;
  }

  /**
   * Returns all values for the given key as a new array, or an empty array if
   * the key does not exist. The returned array is a copy.
   */
  getAll(key: K): V[] {
    return Array.from(this.get(key) ?? []);
  }

  /**
   * Returns whether the given value is present in the set associated with the
   * given key.
   */
  hasValue(key: K, value: V): boolean {
    const values = this.get(key);

    return values ? values.has(value) : false;
  }

  /**
   * Removes multiple values from the set associated with the given key.
   * If the set is emptied by this call, the key is deleted from the map.
   * Returns the number of values removed.
   */
  removeMany(key: K, values: Iterable<V>): number {
    const set = this.get(key);

    if (!set) {
      return 0;
    }

    let removed = 0;

    for (const value of values) {
      if (set.delete(value)) {
        removed++;
      }
    }

    if (removed > 0 && set.size === 0) {
      this.delete(key);
    }

    return removed;
  }

  /**
   * Removes a single value from the set associated with the given key.
   * If the set is emptied by this call, the key is deleted from the map.
   * Returns whether a value was removed.
   */
  removeOne(key: K, value: V): boolean {
    return this.removeMany(key, [value]) > 0;
  }

  /**
   * Returns the Set for the given key, creating and storing an empty one if it
   * does not yet exist.
   */
  private getOrCreate(key: K): Set<V> {
    let set = this.get(key);

    if (!set) {
      set = new Set<V>();
      this.set(key, set);
    }

    return set;
  }
}
