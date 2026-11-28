# ngrx-utils

NgRx signal store utilities.

## `withStateLogger`

Logs every state change of a signal store at `debug`, through a `Logger` scoped to the store name.

```ts
const CartStore = signalStore(
  { providedIn: 'root' },
  withStateLogger('Cart'),
  withState({ items: [] as string[] })
);
```

Output is off by default. Switch it on with `DEBUG=cart:*` in Node, or `localStorage.debug = 'cart:*'`
in the browser (see `@cybertecpty/logging-utils`).

State is logged as-is unless the store says otherwise. Name the top-level fields to leave out
(`omit`) or to show as `[REDACTED]` (`mask`), and their values never reach the logger or any
transport:

```ts
withStateLogger('Session', { omit: ['token'], mask: ['email'] });
```

Only top-level fields are matched, and naming a field the store does not have throws when the
store is created, so a typo cannot leak a value. A store that passes no options logs its whole state.

## Running unit tests

Run `nx test ngrx-utils` to execute the unit tests.
