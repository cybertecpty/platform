# `signal-store` generator

Scaffolds an NgRx signal store in a project, with a spec, and exports it from the project's barrel.
The store file is named for the store (`book-search` becomes `book-search-store.ts`, exporting
`BookSearchStore`) and holds:

- a state type, empty for you to fill in, and its initial state,
- an event group for the store, with no events yet,
- the `signalStore(...)` itself, provided in root and logging its state changes with
  `withStateLogger` from `@cybertecpty/ngrx-utils`.

The spec injects the store and checks it exists. Both files go in the `lib` folder of the project's
source root, under `--directory`.

The generator fails for a project tagged `type:testing` or `type:types`; a `type:utils` project is
fine. It also fails when the store or its spec already exists, so a rerun cannot replace a store you
have edited; delete the files first to regenerate. It does not add `@ngrx/signals` to the workspace;
install it yourself.

## Usage

```sh
nx g @cybertecpty/ngrx-plugin:signal-store {name} --project={project}
```

## Options

- `name` — the first positional argument. The store's name, in kebab-case.
- `--project` — the project to add the store to.
- `--addEntities` — add `withEntities` to the store, with a `{Name}Entity` type (`{ id: string }`) to
  rename and fill in, and check in the spec that the store starts with no entities. Defaults to
  `false`.
- `--directory` — the folder under the project's `src/lib` to place the store in. Defaults to
  `stores`.
- `--export` — export the store from the project's barrel (`src/index.ts`). Defaults to `true`.
- `--providedInRoot` — provide the store in the root injector. When `false`, the generated spec
  provides the store itself. Defaults to `true`.
- `--skipEvents` — leave out the event group, `{name}Events`, which is created with `eventGroup`
  and has no events yet. Defaults to `false`.
- `--skipLogger` — leave out `withStateLogger`. Defaults to `false`.
- `--skipFormat` — skip formatting files.
