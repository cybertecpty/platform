import type { GeneratorCallback, Tree } from '@nx/devkit';
import { addProjectConfiguration, updateJson, writeJson } from '@nx/devkit';
import type { TsConfigJson } from 'type-fest';

export interface CreateFakeLibraryGeneratorOptions {
  /** Contents of the project's `tsconfig.lib.json`; not written when omitted. */
  tsConfigLib?: Record<string, unknown>;
}

/** The options the fake reads from the wrapper's call to the wrapped generator. */
interface FakeLibraryGeneratorSchema {
  name: string;
  directory: string;
}

/**
 * Build a stand-in for a wrapped `@nx` library or plugin generator, for
 * specs of our generators that delegate to one. Like the real generator, it
 * adds the project configuration and appends the project's path to
 * `tsconfig.base.json` (unsorted), optionally writes `tsconfig.lib.json`, so
 * the wrapper's post-delegation edits have a project to read, then returns a
 * no-op task.
 */
export const createFakeLibraryGenerator =
  ({ tsConfigLib }: CreateFakeLibraryGeneratorOptions = {}) =>
  (tree: Tree, { name, directory }: FakeLibraryGeneratorSchema): Promise<GeneratorCallback> => {
    addProjectConfiguration(tree, name, {
      root: directory,
      projectType: 'library',
      targets: { build: {} }
    });

    if (tsConfigLib) {
      writeJson(tree, `${directory}/tsconfig.lib.json`, tsConfigLib);
    }

    updateJson<TsConfigJson>(tree, 'tsconfig.base.json', json => ({
      ...json,
      compilerOptions: {
        ...json.compilerOptions,
        paths: {
          ...json.compilerOptions?.paths,
          [`@cybertecpty/${name}`]: [`./${directory}/src/index.ts`]
        }
      }
    }));

    return Promise.resolve(() => undefined);
  };
