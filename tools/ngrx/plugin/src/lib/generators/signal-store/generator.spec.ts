import { addProjectConfiguration, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { signalStoreGenerator } from './generator';
import type { SignalStoreGeneratorOptions } from './schema';

const ROOT = 'libs/demo';
const STORE_DIR = `${ROOT}/src/lib/stores`;
const BARREL = `${ROOT}/src/index.ts`;

function addProject(tree: Tree, tags: string[] = ['type:feature']): void {
  addProjectConfiguration(tree, 'demo', {
    root: ROOT,
    sourceRoot: `${ROOT}/src`,
    projectType: 'library',
    tags
  });
  tree.write(BARREL, "export * from './lib/existing';\n");
}

describe('signalStoreGenerator', () => {
  let tree: Tree;

  const generate = (options: Partial<SignalStoreGeneratorOptions> = {}) =>
    signalStoreGenerator(tree, { name: 'book-search', project: 'demo', ...options });

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    addProject(tree);
  });

  it('writes the store and its spec to `stores/`, named for the store', async () => {
    await generate();

    expect(tree.exists(`${STORE_DIR}/book-search-store.ts`)).toBe(true);
    expect(tree.exists(`${STORE_DIR}/book-search-store.spec.ts`)).toBe(true);
  });

  it('names the store and its state after the store name', async () => {
    await generate();

    const store = tree.read(`${STORE_DIR}/book-search-store.ts`, 'utf-8');

    expect(store).toContain('export const BookSearchStore = signalStore(');
    expect(store).toContain('export type BookSearchState = Record<string, never>;');
    expect(store).toContain('export const bookSearchEvents = eventGroup(');
    expect(store).toContain("source: 'Book Search'");
  });

  it('provides the store in root and logs its state by default', async () => {
    await generate();

    const store = tree.read(`${STORE_DIR}/book-search-store.ts`, 'utf-8');

    expect(store).toContain("{ providedIn: 'root' }");
    expect(store).toContain("import { withStateLogger } from '@cybertecpty/ngrx-utils'");
    expect(store).toContain("withStateLogger('BookSearchStore')");
  });

  it('leaves out the logger with `skipLogger`', async () => {
    await generate({ skipLogger: true });

    const store = tree.read(`${STORE_DIR}/book-search-store.ts`, 'utf-8');

    expect(store).not.toContain('withStateLogger');
  });

  it('leaves out `providedIn` when `providedInRoot` is false', async () => {
    await generate({ providedInRoot: false });

    const store = tree.read(`${STORE_DIR}/book-search-store.ts`, 'utf-8');

    expect(store).not.toContain('providedIn');
  });

  describe('generated spec providers', () => {
    const readSpec = () => tree.read(`${STORE_DIR}/book-search-store.spec.ts`, 'utf-8');

    it('provides the logger by default, because the store logs its state', async () => {
      await generate();

      expect(readSpec()).toContain("import { provideLogger } from '@cybertecpty/angular-core';");
      expect(readSpec()).toContain("providers: [provideLogger('test')]");
    });

    it('provides nothing when the store is in root and has no logger', async () => {
      await generate({ skipLogger: true });

      expect(readSpec()).not.toContain('providers');
      expect(readSpec()).not.toContain('provideLogger');
    });

    it('provides the store itself when it is not provided in root', async () => {
      await generate({ providedInRoot: false, skipLogger: true });

      expect(readSpec()).toContain('providers: [BookSearchStore]');
    });

    it('provides both the store and the logger when it needs both', async () => {
      await generate({ providedInRoot: false });

      expect(readSpec()).toContain("providers: [BookSearchStore, provideLogger('test')]");
    });

    it('writes a well-formed spec when formatting is skipped', async () => {
      await generate({ providedInRoot: false, skipLogger: true, skipFormat: true });

      expect(readSpec()).toContain('providers: [BookSearchStore] });\n  });\n');
      expect(readSpec()).not.toMatch(/[;{)]it\(/);
    });
  });

  it('refuses to overwrite a store that already exists, and leaves it as it was', async () => {
    await generate();
    tree.write(`${STORE_DIR}/book-search-store.ts`, '// edited by hand\n');

    await expect(generate()).rejects.toThrow(/book-search-store\.ts and .* already exists/);
    expect(tree.read(`${STORE_DIR}/book-search-store.ts`, 'utf-8')).toBe('// edited by hand\n');
  });

  describe('skipEvents', () => {
    it('adds an event group by default', async () => {
      await generate();

      const store = tree.read(`${STORE_DIR}/book-search-store.ts`, 'utf-8');

      expect(store).toContain("import { eventGroup } from '@ngrx/signals/events';");
      expect(store).toContain('export const bookSearchEvents = eventGroup(');
      expect(store).toContain("source: 'Book Search'");
    });

    it('leaves the event group out with `skipEvents`', async () => {
      await generate({ skipEvents: true });

      const store = tree.read(`${STORE_DIR}/book-search-store.ts`, 'utf-8');

      expect(store).not.toContain('eventGroup');
      expect(store).not.toContain('bookSearchEvents');
      expect(store).toContain('export const BookSearchStore = signalStore(');
    });

    it('writes a well-formed store without events when formatting is skipped', async () => {
      await generate({ skipEvents: true, skipFormat: true });

      const store = tree.read(`${STORE_DIR}/book-search-store.ts`, 'utf-8');

      expect(store).toContain(
        'export const initialBookSearchState: BookSearchState = {};\n\nexport const BookSearchStore'
      );
    });
  });

  describe('addEntities', () => {
    it('leaves entities out by default', async () => {
      await generate();

      const store = tree.read(`${STORE_DIR}/book-search-store.ts`, 'utf-8');
      const spec = tree.read(`${STORE_DIR}/book-search-store.spec.ts`, 'utf-8');

      expect(store).not.toContain('withEntities');
      expect(store).not.toContain('BookSearchEntity');
      expect(spec).not.toContain('entities');
    });

    it('adds `withEntities` and an entity type to the store', async () => {
      await generate({ addEntities: true });

      const store = tree.read(`${STORE_DIR}/book-search-store.ts`, 'utf-8');

      expect(store).toContain("import { withEntities } from '@ngrx/signals/entities';");
      expect(store).toContain('export interface BookSearchEntity {');
      expect(store).toContain('withEntities<BookSearchEntity>()');
    });

    it('checks the entities in the generated spec', async () => {
      await generate({ addEntities: true });

      expect(tree.read(`${STORE_DIR}/book-search-store.spec.ts`, 'utf-8')).toContain(
        'expect(store.entities()).toEqual([]);'
      );
    });

    it('writes a well-formed store when formatting is skipped', async () => {
      await generate({ addEntities: true, skipFormat: true });

      const store = tree.read(`${STORE_DIR}/book-search-store.ts`, 'utf-8');

      expect(store).toContain(
        'withState(initialBookSearchState),\n  withEntities<BookSearchEntity>()\n);'
      );
    });
  });

  it('places the store in `directory` under the source `lib` folder', async () => {
    await generate({ directory: 'books/state' });

    expect(tree.exists(`${ROOT}/src/lib/books/state/book-search-store.ts`)).toBe(true);
  });

  it('exports the store from the project barrel, relative to the source root', async () => {
    await generate();

    const barrel = tree.read(BARREL, 'utf-8');

    expect(barrel).toContain("export * from './lib/existing';");
    expect(barrel).toContain("export * from './lib/stores/book-search-store';");
  });

  it('exports from the `directory` it was placed in', async () => {
    await generate({ directory: 'books/state' });

    expect(tree.read(BARREL, 'utf-8')).toContain(
      "export * from './lib/books/state/book-search-store';"
    );
  });

  it('does not touch the barrel when `export` is false', async () => {
    await generate({ export: false });

    expect(tree.read(BARREL, 'utf-8')).toBe("export * from './lib/existing';\n");
  });

  it.each(['testing', 'types'])('rejects a %s project and writes nothing', async type => {
    tree = createTreeWithEmptyWorkspace();
    addProject(tree, [`type:${type}`]);

    await expect(generate()).rejects.toThrow(
      `Invalid project type for Signal Store: "${type}". Project type cannot be any of: testing, types`
    );
    expect(tree.exists(`${STORE_DIR}/book-search-store.ts`)).toBe(false);
  });

  it('accepts a utils project', async () => {
    tree = createTreeWithEmptyWorkspace();
    addProject(tree, ['type:utils']);

    await generate();

    expect(tree.exists(`${STORE_DIR}/book-search-store.ts`)).toBe(true);
  });

  it('throws when the project does not exist', async () => {
    await expect(generate({ project: 'missing' })).rejects.toThrow(/missing/);
  });
});
